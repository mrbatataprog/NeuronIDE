
use wasm_bindgen::prelude::*;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileType {
    File,
    Directory,
    Unknown,
}

#[wasm_bindgen]
pub struct FileStorage {
    id_to_index: HashMap<u32, usize>,

    ids: Vec<u32>,
    names: Vec<String>,
    kinds: Vec<FileType>,

    is_open: Vec<bool>,
    is_saved: Vec<bool>,
    on_hover: Vec<bool>,
    rendered: Vec<bool>,
    loaded: Vec<bool>,

    content: Vec<Option<String>>,
    parents: Vec<Option<u32>>,
    children: Vec<HashSet<u32>>,

    projects: HashSet<u32>,
    selected_elements: HashSet<u32>,
    copied_elements: HashSet<u32>,
    cutted_elements: HashSet<u32>,

    next_id: u32,
    opened_file: Option<u32>,
}

#[wasm_bindgen]
impl FileStorage {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            id_to_index: HashMap::new(),
            ids: Vec::new(),
            names: Vec::new(),
            kinds: Vec::new(),
            is_open: Vec::new(),
            is_saved: Vec::new(),
            on_hover: Vec::new(),
            rendered: Vec::new(),
            loaded: Vec::new(),
            content: Vec::new(),
            parents: Vec::new(),
            children: Vec::new(),
            projects: HashSet::new(),
            selected_elements: HashSet::new(),
            copied_elements: HashSet::new(),
            cutted_elements: HashSet::new(),
            next_id: 1,
            opened_file: None,
        }
    }

    pub fn add_element(&mut self, name: String, kind: u8, parent: Option<u32>) -> Result<u32, JsValue> {
        let parent_index = match parent {
            Some(parent_id) => { 
                Some(*self.id_to_index.get(&parent_id).ok_or_else(|| 
                    JsValue::from_str("Parent not found"))?) 
                }
            None => None,
        };

        let id = self.next_id;
        self.next_id += 1;

        let index = self.ids.len();

        let kind = match kind {
            0 => FileType::File,
            1 => FileType::Directory,
            _ => FileType::Unknown,
        };

        self.id_to_index.insert(id, index);

        self.ids.push(id);
        self.names.push(name);
        self.kinds.push(kind);

        self.is_open.push(false);
        self.is_saved.push(false);
        self.on_hover.push(false);
        self.rendered.push(false);
        self.loaded.push(false);

        self.content.push(None);
        self.parents.push(parent);
        self.children.push(HashSet::new());

        if let Some(parent_index) = parent_index {
            self.children[parent_index].insert(id);
        } else {
            self.projects.insert(id);
        }

        Ok(id)
    }

    pub fn remove_element(&mut self, id: u32) {
        self.selected_elements.remove(&id);
        self.copied_elements.remove(&id);
        self.cutted_elements.remove(&id);

        if let Some(index) = self.id_to_index.remove(&id) {
            self.ids.remove(index);
            self.names.remove(index);
            self.kinds.remove(index);
            self.is_open.remove(index);
            self.is_saved.remove(index);
            self.on_hover.remove(index);
            self.rendered.remove(index);
            self.loaded.remove(index);
            self.content.remove(index);
            self.parents.remove(index);
            self.children.remove(index);

            for (i, element_id) in self.ids.iter().enumerate() {
                self.id_to_index.insert(*element_id, i);
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.ids.is_empty()
    }

    pub fn set_loaded(&mut self, id: u32, value: bool) {
        if let Some(&index) = self.id_to_index.get(&id) {
            self.loaded[index] = value;
        }
    }

    pub fn set_open(&mut self, id: u32, value: bool) {
        if let Some(&index) = self.id_to_index.get(&id) {
            self.is_open[index] = value;
        }
    }

    pub fn get_name(&self, id: u32) -> Option<String> {
        let index = *self.id_to_index.get(&id)?;
        Some(self.names[index].clone())
    }

    pub fn get_kind(&self, id: u32) -> u8 {
        let Some(&index) = self.id_to_index.get(&id) else {
            return 2;
        };

        match self.kinds[index] {
            FileType::File => 0,
            FileType::Directory => 1,
            FileType::Unknown => 2,
        }
    }

    pub fn get_parent(&self, id: u32) -> Option<u32> {
        let index = *self.id_to_index.get(&id)?;
        self.parents[index]
    }

    pub fn get_open(&self, id: u32) -> bool {
        self.id_to_index.get(&id).map(|&index| self.is_open[index]).unwrap_or(false)
    }

    pub fn get_loaded(&self, id: u32) -> bool {
        self.id_to_index.get(&id).map(|&index| self.loaded[index]).unwrap_or(false)
    }

    pub fn contains(&self, id: u32) -> bool {
        self.id_to_index.contains_key(&id)
    }

    pub fn get_all_ids(&self) -> Vec<u32> {
        self.ids.clone()
    }

    pub fn len(&self) -> usize {
        self.ids.len()
    }

    pub fn get_content(&self, id: u32) -> Option<String> {
        let index = *self.id_to_index.get(&id)?;
        self.content[index].clone()
    }

    pub fn set_content(&mut self, id: u32, value: String) {
        if let Some(&index) = self.id_to_index.get(&id) {
            self.content[index] = Some(value);
        }
    }

    pub fn clear_selected_elements(&mut self) {
        self.selected_elements.clear();
    }

    pub fn get_selected_elements(&self) -> Vec<u32> {
        self.selected_elements.iter().copied().collect()
    }

    pub fn add_copied_element(&mut self, id: u32) {
        if self.id_to_index.contains_key(&id) {
            self.copied_elements.insert(id);
        }
    }

    pub fn clear_copied_elements(&mut self) {
        self.copied_elements.clear();
    }

    pub fn get_cutted_elements(&self) -> Vec<u32> {
        self.cutted_elements.iter().copied().collect()
    }

    pub fn add_cutted_element(&mut self, id: u32) {
        if self.id_to_index.contains_key(&id) {
            self.cutted_elements.insert(id);
        }
    }

    pub fn clear_cutted_elements(&mut self) {
        self.cutted_elements.clear();
    }

    pub fn add_selected_element(&mut self, id: u32) {
        if self.id_to_index.contains_key(&id) {
            self.selected_elements.insert(id);
        }
    }

    pub fn is_selected(&self, id: u32) -> bool {
        self.selected_elements.contains(&id)
    }

    pub fn is_cutted(&self, id: u32) -> bool {
        self.cutted_elements.contains(&id)
    }

    pub fn get_children(&self, id: u32) -> Vec<u32> {
        let Some(&index) = self.id_to_index.get(&id) else {
            return Vec::new();
        };

        self.children[index].iter().copied().collect()
    }

    pub fn get_index(&self, id: u32) -> Option<usize> {
        self.id_to_index.get(&id).copied()
    }
}
