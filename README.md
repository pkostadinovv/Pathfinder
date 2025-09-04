# Pathfinder

Pathfinder was a freelance project commissioned by a tourist village in Bulgaria. The goal was to create a **navigation app for hikers and tourists** that worked fully offline, with **zero budget** available for infrastructure or paid services.  

While the project was discontinued due to resource limitations, several core functionalities were successfully implemented and may be useful for future development.

---

## Features

### Implemented
- **Offline map support**  
  - Loads and displays map tiles locally without requiring a network connection.  
- **Trail creation and recording**  
  - Record GPS trails in real time.  
  - Save and post trails when online.  
- **Trail information pages**  
  - Each trail can have a dedicated info page with details and descriptions.  

### Planned (not implemented or incomplete)
- Community sharing and syncing of trails.  
- Enhanced point-of-interest database.  
- Localized content and multilingual support.  
- Seamless offline/online syncing for all features.  

---

## Motivation

Tourism in remote areas often suffers from a lack of connectivity. The vision for Pathfinder was to provide:  
- A **reliable offline navigation app** for tourists.  
- A way for locals to **share trails and routes** without depending on costly hosting services.  
- An **accessible, open-source approach** that could grow with community input.

---

## Technical Details

- Built with **[React Native](https://reactnative.dev/)** and **[Expo](https://expo.dev/)** using TypeScript.  
- Offline map functionality was implemented using locally stored **map tiles** downloaded via Fiddler .  
- Trail recording and posting used the device’s **GPS sensors** and a simple API for online sync.  
- Designed to run on both Android and iOS devices with minimal setup.  

---

## Challenges

The project had to be built with **0 budget**, which caused difficulties:  
- No funding for hosting map tile servers or maintaining backend infrastructure.  
- Limited time to implement advanced features like syncing and collaborative editing.  
- Dependency on free/open tools meant workarounds were required for some features.  

Ultimately, these challenges led to the discontinuation of the project. However, the **offline map engine** and **trail recording system** were completed and can serve as a foundation for similar projects.

---

## Status

🚧 **Discontinued** — Pathfinder is no longer maintained.  
Some parts of the codebase may still be useful if you are building:
- Offline map apps
- Hiking/trail navigation tools
- Lightweight GPS-based apps with minimal dependencies  

---
