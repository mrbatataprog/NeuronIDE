
use ropey::Rope;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Editor {
    text: Rope,
}

#[wasm_bindgen]
impl Editor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Editor {
        Self { text: Rope::new() }
    }

    pub fn set_text(&mut self, text: &str) {
        self.text = Rope::from_str(text);
    }

    pub fn clear(&mut self) {
        self.text = Rope::new();
    }

    pub fn get_text(&self) -> String {
        self.text.to_string()
    }

    pub fn insert(&mut self, char_index: usize, text: &str) -> Result<(), JsValue> {
        self.text.try_insert(char_index, text).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn delete(&mut self, start: usize, end: usize) -> Result<(), JsValue> {
        self.check_range(start, end)?;
        self.text.try_remove(start..end).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn replace(&mut self, start: usize, end: usize, replacement: &str) -> Result<(), JsValue> {
        self.check_range(start, end)?;

        self.text.try_remove(start..end).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.text.try_insert(start, replacement).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn line_count(&self) -> usize {
        self.text.len_lines()
    }

    pub fn char_count(&self) -> usize {
        self.text.len_chars()
    }

    pub fn byte_count(&self) -> usize {
        self.text.len_bytes()
    }

    pub fn utf16_length(&self) -> usize {
        self.text.len_utf16_cu()
    }

    pub fn get_line(&self, line_index: usize) -> Option<String> {
        self.text.get_line(line_index).map(|line| line.to_string())
    }

    pub fn get_char(&self, char_index: usize) -> Option<String> {
        self.text.get_char(char_index).map(|ch| ch.to_string())
    }

    pub fn get_range(&self, start: usize, end: usize) -> Result<String, JsValue> {
        self.check_range(start, end)?;
        Ok(self.text.slice(start..end).to_string())
    }

    pub fn get_text_from_byte(&self, byte_index: usize) -> Result<String, JsValue> {
        if byte_index > self.text.len_bytes() {
            return Err(JsValue::from_str("Byte index out of bounds"));
        }

        let char_index = self.text.try_byte_to_char(byte_index).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let end = (char_index + 4096).min(self.text.len_chars());

        Ok(self.text.slice(char_index..end).to_string())
    }

    pub fn char_to_byte(&self, char_index: usize) -> Result<usize, JsValue> {
        if char_index > self.text.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(self.text.char_to_byte(char_index))
    }

    pub fn get_lines(&self, start: usize, end: usize) -> Result<String, JsValue> {
        if start > end || end > self.text.len_lines() {
            return Err(JsValue::from_str("Invalid line range"));
        }

        let char_start = self.text.line_to_char(start);
        let char_end = self.text.line_to_char(end);

        Ok(self.text.slice(char_start..char_end).to_string())
    }

    pub fn line_to_char(&self, line_index: usize) -> Result<usize, JsValue> {
        if line_index > self.text.len_lines() {
            return Err(JsValue::from_str("Line index out of bounds"));
        }

        Ok(self.text.line_to_char(line_index))
    }

    pub fn char_to_line(&self, char_index: usize) -> Result<usize, JsValue> {
        if char_index > self.text.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(self.text.char_to_line(char_index))
    }

    pub fn char_to_utf16(&self, char_index: usize) -> Result<usize, JsValue> {
        if char_index > self.text.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(self.text.char_to_utf16_cu(char_index))
    }

    pub fn utf16_to_char(&self, utf16_index: usize) -> Result<usize, JsValue> {
        self.text.try_utf16_cu_to_char(utf16_index).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn check_range(&self, start: usize, end: usize) -> Result<(), JsValue> {
        if start > end || end > self.text.len_chars() {
            return Err(JsValue::from_str("Invalid character range"));
        }

        Ok(())
    }
    pub fn get_line_content(&self, line_index: usize) -> Option<String> {
        let line = self.text.get_line(line_index)?;
        let mut end = line.len_chars();

        while end > 0 {
            match line.get_char(end - 1) {
                Some('\n') | Some('\r') => end -= 1,
                _ => break,
            }
        }

        Some(line.slice(..end).to_string())
    }
}
