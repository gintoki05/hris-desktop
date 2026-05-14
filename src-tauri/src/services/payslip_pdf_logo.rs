use std::io::Cursor;

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use flate2::{write::ZlibEncoder, Compression};
use png::{ColorType, Decoder, Transformations};

use crate::error::AppError;

pub struct PdfLogoImage {
    pub width: u32,
    pub height: u32,
    stream_hex: String,
    filter: &'static str,
}

impl PdfLogoImage {
    pub fn draw_size(&self, max_width: f32, max_height: f32) -> (f32, f32) {
        let width = self.width as f32;
        let height = self.height as f32;
        let scale = (max_width / width).min(max_height / height);

        (width * scale, height * scale)
    }

    pub fn to_pdf_object(&self) -> String {
        format!(
            "<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode {}] /Length {} >> stream\n{}>\nendstream",
            self.width,
            self.height,
            self.filter,
            self.stream_hex.len() + 2,
            self.stream_hex,
        )
    }
}

pub fn parse_logo_data_url(value: &str) -> Result<Option<PdfLogoImage>, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let Some((metadata, encoded)) = trimmed.split_once(',') else {
        return Ok(None);
    };
    if !metadata.ends_with(";base64") {
        return Ok(None);
    }

    let image_bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| AppError::Database(format!("logo perusahaan tidak valid: {error}")))?;

    if metadata.starts_with("data:image/png") {
        return decode_png_logo(&image_bytes).map(Some);
    }

    if metadata.starts_with("data:image/jpeg") || metadata.starts_with("data:image/jpg") {
        return decode_jpeg_logo(&image_bytes).map(Some);
    }

    Ok(None)
}

fn decode_png_logo(bytes: &[u8]) -> Result<PdfLogoImage, AppError> {
    let mut decoder = Decoder::new(Cursor::new(bytes));
    decoder.set_transformations(Transformations::EXPAND | Transformations::STRIP_16);
    let mut reader = decoder
        .read_info()
        .map_err(|error| AppError::Database(format!("logo PNG tidak bisa dibaca: {error}")))?;
    let buffer_size = reader.output_buffer_size().ok_or_else(|| {
        AppError::Database("ukuran buffer logo PNG tidak bisa dihitung".to_string())
    })?;
    let mut buffer = vec![0; buffer_size];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|error| AppError::Database(format!("logo PNG tidak bisa dibaca: {error}")))?;
    let pixels = &buffer[..info.buffer_size()];
    let rgb_pixels = match info.color_type {
        ColorType::Rgb => pixels.to_vec(),
        ColorType::Rgba => rgba_to_rgb_on_white(pixels),
        ColorType::Grayscale => grayscale_to_rgb(pixels),
        ColorType::GrayscaleAlpha => grayscale_alpha_to_rgb_on_white(pixels),
        ColorType::Indexed => {
            return Err(AppError::Database(
                "logo PNG palet belum didukung untuk slip PDF".to_string(),
            ))
        }
    };
    let compressed = compress_zlib(&rgb_pixels)?;

    Ok(PdfLogoImage {
        width: info.width,
        height: info.height,
        stream_hex: hex_encode(&compressed),
        filter: "/FlateDecode",
    })
}

fn decode_jpeg_logo(bytes: &[u8]) -> Result<PdfLogoImage, AppError> {
    let (width, height) = read_jpeg_dimensions(bytes).ok_or_else(|| {
        AppError::Database("dimensi logo JPG tidak bisa dibaca".to_string())
    })?;

    Ok(PdfLogoImage {
        width,
        height,
        stream_hex: hex_encode(bytes),
        filter: "/DCTDecode",
    })
}

fn rgba_to_rgb_on_white(pixels: &[u8]) -> Vec<u8> {
    let mut rgb = Vec::with_capacity(pixels.len() / 4 * 3);
    for pixel in pixels.chunks_exact(4) {
        let alpha = pixel[3] as u16;
        for channel in &pixel[..3] {
            let value = ((*channel as u16 * alpha) + (255 * (255 - alpha))) / 255;
            rgb.push(value as u8);
        }
    }
    rgb
}

fn grayscale_to_rgb(pixels: &[u8]) -> Vec<u8> {
    let mut rgb = Vec::with_capacity(pixels.len() * 3);
    for value in pixels {
        rgb.extend_from_slice(&[*value, *value, *value]);
    }
    rgb
}

fn grayscale_alpha_to_rgb_on_white(pixels: &[u8]) -> Vec<u8> {
    let mut rgb = Vec::with_capacity(pixels.len() / 2 * 3);
    for pixel in pixels.chunks_exact(2) {
        let gray = pixel[0] as u16;
        let alpha = pixel[1] as u16;
        let value = ((gray * alpha) + (255 * (255 - alpha))) / 255;
        rgb.extend_from_slice(&[value as u8, value as u8, value as u8]);
    }
    rgb
}

fn compress_zlib(bytes: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    std::io::Write::write_all(&mut encoder, bytes)?;
    Ok(encoder.finish()?)
}

fn read_jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return None;
    }

    let mut index = 2;
    while index + 9 < bytes.len() {
        if bytes[index] != 0xFF {
            index += 1;
            continue;
        }

        let marker = bytes[index + 1];
        index += 2;

        if marker == 0xD9 || marker == 0xDA {
            break;
        }

        if index + 2 > bytes.len() {
            break;
        }

        let segment_length = u16::from_be_bytes([bytes[index], bytes[index + 1]]) as usize;
        if segment_length < 2 || index + segment_length > bytes.len() {
            break;
        }

        if matches!(
            marker,
            0xC0 | 0xC1 | 0xC2 | 0xC3 | 0xC5 | 0xC6 | 0xC7 | 0xC9 | 0xCA | 0xCB | 0xCD
                | 0xCE | 0xCF
        ) {
            let height = u16::from_be_bytes([bytes[index + 3], bytes[index + 4]]) as u32;
            let width = u16::from_be_bytes([bytes[index + 5], bytes[index + 6]]) as u32;
            return Some((width, height));
        }

        index += segment_length;
    }

    None
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(*byte >> 4) as usize] as char);
        encoded.push(HEX[(*byte & 0x0F) as usize] as char);
    }
    encoded
}
