# PreAlpha 2.0.0 - ChangeLog
## OverView
PreAlpha 2.0.0 brings new improvements. For the side of functionality, bug fixes, and better approaches for a better user experience. And improving overall stability of the IDE.

The release introduces new functionalities, addresses a few bugs found during development, and includes more readable source code. This update has been tested on the performance side and includes really stable memory usage with heavy directories.

## Features
PreAlpha 2.0.0 update. Mainly focuses on a specific goal. This includes all basic tasks for the IDE to be usable and creating the first installer file. And be able to run smoothly, with other features such as:
- **Support File Menu**: This updates gives the IDE the ablity of opening and saving files/directories. This can be done using the top menu button. Also allows opening recent projects/directories that have been opened before
- **Support explorer scrolling**: Explorer has the ability to scroll smoothly and without causing any noticeable lag or delay when opening large directories.
- **Updated the tab**: The tab was outdated, using an old HTML-lookup approach. This has been cleaned up, and a new feature was added, allowing the IDE to handle multiple files with the same names but not the same paths.
- **Installer file**: Created the first installer file. IDE is unstable but can be used for basic tasks. Not recommended for real-world usage. Wait for coming updates for more stability.
- **New file/folder option**: This update allows the option to open a file/folder in a completely new window.


## Optimizations
Multiple heavy optimizations focus mainly on max rendering and redrawing the HTML code. Giving the IDE more performance. Optimizations stand on:
- **Max rendering for explorer**: Now the explorer can max render all elements, making scrolling/selecting or opening a file Smooth.
- **Limiting DOM redrawing**: DOM now get it's element stored in the 'Explorer ', allowing it to be more efficient.


## Bug fixes
This updates brings bug(s) that has been found during development. Bug(s) are fixed after publishing this update.

- **Ghost ID**: When the IDE handles the element deletion, it never removes that from the parent's List (array), causing a ghost child.
- **Refreshing the window doesn't rest**: Now window refreshing saves the last directories was opens. And reopens automatically.
- **Warning message when deleting**: Deleting a file/folder before did not give a warning message. This has been solved; now it gives a warning to confirm the deletion.

## Notes
In case of any found bugs. Please sumbit a report in [github issues](https://github.com/mrbatataprog/NeuronIDE/issues). Construbuting with the project via the main IDE [github repo](https://github.com/mrbatataprog/NeuronIDE).

|| Version: Pre-Alpha 2.0.0 Release date: 11/25/2026