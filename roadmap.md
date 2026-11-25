# Pre-Alpha 2.0.0 - ChangeLog
## Goals:
- > **Support file operations**
- > **Support explorer scrolling**
- > **Update the tab with '.\path' system**
- > **Change clipboard to rust backend**
- Make the exe installer
- > **Switch to use GetName/GetParts instead of regex**
- > **ReCreated the tab to use events**
## Bugs
- When deleting a element their parent never get the child ID removed.
- Changed Children storing from hashset to vector
- When closing a directory. The scrolling bar never get updated
- Scrolling was unaccured. File size was incorrect and changed to using HTML and ID.
- When changing the file in the tab. it never saves the modifed content