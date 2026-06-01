use std::fs;
use std::io::Read;
use std::path::Path;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptDocumentExtract {
    pub file_name: String,
    pub format: String,
    pub text: String,
    pub char_count: usize,
}

fn decode_xml_entities(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

/// 从 Word document.xml 提取纯文本（段落换行）
pub(crate) fn docx_xml_to_plain(xml: &str) -> String {
    let mut with_breaks = xml.replace("</w:p>", "\n");
    with_breaks = with_breaks.replace("<w:tab/>", "\t");
    with_breaks = with_breaks.replace("<w:tab />", "\t");
    let mut out = String::new();
    let mut in_tag = false;
    for ch in with_breaks.chars() {
        if ch == '<' {
            in_tag = true;
            continue;
        }
        if ch == '>' {
            in_tag = false;
            continue;
        }
        if !in_tag {
            out.push(ch);
        }
    }
    decode_xml_entities(&out)
        .lines()
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn extract_docx(bytes: &[u8]) -> Result<String, String> {
    let reader = std::io::Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(reader).map_err(|e| format!("docx 解压失败：{}", e))?;
    let mut file = zip
        .by_name("word/document.xml")
        .map_err(|_| "不是有效的 docx（缺少 word/document.xml）".to_string())?;
    let mut xml = String::new();
    file.read_to_string(&mut xml)
        .map_err(|e| format!("读取 docx 正文失败：{}", e))?;
    let text = docx_xml_to_plain(&xml);
    if text.trim().is_empty() {
        return Err("docx 中未提取到可读文本".into());
    }
    Ok(text)
}

fn extract_text_file(bytes: &[u8]) -> Result<String, String> {
    let text = String::from_utf8_lossy(bytes).into_owned();
    if text.trim().is_empty() {
        return Err("文件内容为空".into());
    }
    Ok(text)
}

fn extract_script_bytes(file_name: &str, bytes: &[u8]) -> Result<ScriptDocumentExtract, String> {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let (format, text) = match ext.as_str() {
        "docx" => ("docx".to_string(), extract_docx(bytes)?),
        "txt" | "md" | "markdown" => (ext, extract_text_file(bytes)?),
        _ => {
            return Err(format!(
                "不支持的格式「.{}」，请使用 .txt / .md / .docx",
                ext
            ))
        }
    };
    let char_count = text.chars().count();
    Ok(ScriptDocumentExtract {
        file_name: file_name.to_string(),
        format,
        text,
        char_count,
    })
}

#[tauri::command]
pub fn extract_script_document(abs_path: String) -> Result<ScriptDocumentExtract, String> {
    let path = Path::new(abs_path.trim());
    if !path.is_file() {
        return Err("文件不存在或不可读".into());
    }
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("script")
        .to_string();
    let bytes = fs::read(path).map_err(|e| format!("读取文件失败：{}", e))?;
    extract_script_bytes(&file_name, &bytes)
}

#[tauri::command]
pub fn extract_script_document_bytes(
    file_name: String,
    data_base64: String,
) -> Result<ScriptDocumentExtract, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.trim())
        .map_err(|e| format!("解码文件内容失败：{}", e))?;
    extract_script_bytes(file_name.trim(), &bytes)
}

#[cfg(test)]
mod tests {
    use super::docx_xml_to_plain;

    #[test]
    fn docx_xml_strips_tags_and_keeps_paragraphs() {
        let xml = r#"<w:p><w:r><w:t>第一场</w:t></w:r></w:p><w:p><w:r><w:t>对白</w:t></w:r></w:p>"#;
        let plain = docx_xml_to_plain(xml);
        assert!(plain.contains("第一场"));
        assert!(plain.contains("对白"));
        assert!(plain.contains('\n'));
    }
}
