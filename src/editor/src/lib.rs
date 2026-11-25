use ropey::Rope;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Editor {
    buffers: HashMap<u32, Rope>,
    active_buffer: u32,
}

#[wasm_bindgen]
impl Editor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Editor {
        Self {
            buffers: HashMap::new(),
            active_buffer: 0,
        }
    }

    pub fn create_buffer(&mut self, id: u32) {
        self.buffers.insert(id, Rope::new());
    }

    fn active_rope(&self) -> Result<&Rope, JsValue> {
        self.buffers.get(&self.active_buffer).ok_or_else(|| JsValue::from_str("No active buffer"))
    }

    fn active_rope_mut(&mut self) -> Result<&mut Rope, JsValue> {
        self.buffers.get_mut(&self.active_buffer).ok_or_else(|| JsValue::from_str("No active buffer"))
    }

    pub fn remove_buffer(&mut self, id: u32) {
        self.buffers.remove(&id);

        if self.active_buffer == id {
            self.active_buffer = self.buffers.keys().next().copied().unwrap_or(0);
        }
    }

    pub fn switch_buffer(&mut self, id: u32) -> Result<(), JsValue> {
        if !self.buffers.contains_key(&id) {
            return Err(JsValue::from_str("Buffer not found"));
        }

        self.active_buffer = id;
        Ok(())
    }

    pub fn has_buffer(&self, id: u32) -> bool {
        self.buffers.contains_key(&id)
    }

    pub fn get_buffer_text(&self, id: u32) -> Result<String, JsValue> {
        self.buffers.get(&id).map(|rope| rope.to_string()).ok_or_else(|| JsValue::from_str("Buffer not found"))
    }

    pub fn clear(&mut self) -> Result<(), JsValue> {
        *self.active_rope_mut()? = Rope::new();
        Ok(())
    }

    pub fn set_text(&mut self, text: &str) -> Result<(), JsValue> {
        *self.active_rope_mut()? = Rope::from_str(text);
        Ok(())
    }

    pub fn get_text(&self) -> Result<String, JsValue> {
        Ok(self.active_rope()?.to_string())
    }

    pub fn char_count(&self) -> Result<usize, JsValue> {
        Ok(self.active_rope()?.len_chars())
    }

    pub fn insert(&mut self, char_index: usize, text: &str) -> Result<(), JsValue> {
        self.active_rope_mut()?.try_insert(char_index, text).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn delete(&mut self, start: usize, end: usize) -> Result<(), JsValue> {
        self.check_range(start, end)?;
        self.active_rope_mut()?.try_remove(start..end).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn replace(&mut self, start: usize, end: usize, replacement: &str) -> Result<(), JsValue> {
        self.check_range(start, end)?;

        let rope = self.active_rope_mut()?;

        rope.try_remove(start..end).map_err(|e| JsValue::from_str(&e.to_string()))?;
        rope.try_insert(start, replacement).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn line_count(&self) -> Result<usize, JsValue> {
        Ok(self.active_rope()?.len_lines())
    }

    pub fn byte_count(&self) -> Result<usize, JsValue> {
        Ok(self.active_rope()?.len_bytes())
    }

    pub fn utf16_length(&self) -> Result<usize, JsValue> {
        Ok(self.active_rope()?.len_utf16_cu())
    }

    pub fn get_line(&self, line_index: usize) -> Result<Option<String>, JsValue> {
        Ok(self.active_rope()?.get_line(line_index).map(|line| line.to_string()))
    }

    pub fn get_char(&self, char_index: usize) -> Result<Option<String>, JsValue> {
        Ok(self.active_rope()?.get_char(char_index).map(|ch| ch.to_string()))
    }

    pub fn get_range(&self, start: usize, end: usize) -> Result<String, JsValue> {
        self.check_range(start, end)?;
        Ok(self.active_rope()?.slice(start..end).to_string())
    }

    pub fn get_text_from_byte(&self, byte_index: usize) -> Result<String, JsValue> {
        let rope = self.active_rope()?;

        if byte_index > rope.len_bytes() {
            return Err(JsValue::from_str("Byte index out of bounds"));
        }

        let char_index = rope.try_byte_to_char(byte_index).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let end = (char_index + 4096).min(rope.len_chars());

        Ok(rope.slice(char_index..end).to_string())
    }

    pub fn char_to_byte(&self, char_index: usize) -> Result<usize, JsValue> {
        let rope = self.active_rope()?;

        if char_index > rope.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(rope.char_to_byte(char_index))
    }

    pub fn get_lines(&self, start: usize, end: usize) -> Result<String, JsValue> {
        let rope = self.active_rope()?;

        if start > end || end > rope.len_lines() {
            return Err(JsValue::from_str("Invalid line range"));
        }

        let char_start = rope.line_to_char(start);
        let char_end = rope.line_to_char(end);

        Ok(rope.slice(char_start..char_end).to_string())
    }

    pub fn line_to_char(&self, line_index: usize) -> Result<usize, JsValue> {
        let rope = self.active_rope()?;

        if line_index > rope.len_lines() {
            return Err(JsValue::from_str("Line index out of bounds"));
        }

        Ok(rope.line_to_char(line_index))
    }

    pub fn char_to_line(&self, char_index: usize) -> Result<usize, JsValue> {
        let rope = self.active_rope()?;

        if char_index > rope.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(rope.char_to_line(char_index))
    }

    pub fn char_to_utf16(&self, char_index: usize) -> Result<usize, JsValue> {
        let rope = self.active_rope()?;

        if char_index > rope.len_chars() {
            return Err(JsValue::from_str("Character index out of bounds"));
        }

        Ok(rope.char_to_utf16_cu(char_index))
    }

    pub fn utf16_to_char(&self, utf16_index: usize) -> Result<usize, JsValue> {
        self.active_rope()?.try_utf16_cu_to_char(utf16_index).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn check_range(&self, start: usize, end: usize) -> Result<(), JsValue> {
        let rope = self.active_rope()?;

        if start > end || end > rope.len_chars() {
            return Err(JsValue::from_str("Invalid character range"));
        }

        Ok(())
    }

    pub fn get_line_content(&self, line_index: usize) -> Result<Option<String>, JsValue> {
        let rope = self.active_rope()?;
        let Some(line) = rope.get_line(line_index) else { return Ok(None); };

        let mut end = line.len_chars();

        while end > 0 {
            match line.get_char(end - 1) {
                Some('\n') | Some('\r') => end -= 1,
                _ => break,
            }
        }

        Ok(Some(line.slice(..end).to_string()))
    }
}
