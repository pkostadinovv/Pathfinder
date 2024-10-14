import AsyncStorage from '@react-native-async-storage/async-storage';

// Path data type representing each dot
type Dot = {
  latitude: number;
  longitude: number;
};

// Structure for storing a unique path
type Path = {
  id: string;
  dots: Dot[];
};

class PathStorage {
  private paths: Path[] = [];

  private generatePathId() {
    return `path_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  addPath(dots: Dot[] = []) {
    const newPathId = this.generatePathId();
    const newPath: Path = {
      id: newPathId,
      dots,
    };
    this.paths.push(newPath);
    return newPathId;
  }

  addDotToPath(pathId: string | null, dot: Dot) {
    if (!pathId) {
      console.warn("Attempting to add a dot to a path with null ID.");
      return;
    }

    const path = this.paths.find((p) => p.id === pathId);
    if (path) {
      path.dots.push(dot);
    } else {
      console.warn(`Path with ID ${pathId} not found.`);
    }
  }

  getPaths() {
    return this.paths;
  }

  getPathById(pathId: string) {
    return this.paths.find((p) => p.id === pathId);
  }

  async savePaths() {
    try {
      await AsyncStorage.setItem('paths', JSON.stringify(this.paths));
      console.log('Paths saved successfully.');
    } catch (error) {
      console.error('Error saving paths:', error);
    }
  }

  async loadPaths() {
    try {
      const storedPaths = await AsyncStorage.getItem('paths');
      if (storedPaths) {
        this.paths = JSON.parse(storedPaths);
        console.log('Paths loaded successfully.');
      }
    } catch (error) {
      console.error('Error loading paths:', error);
    }
  }

  async clearPaths() {
    try {
      await AsyncStorage.removeItem('paths');
      this.paths = [];
      console.log('All paths cleared.');
    } catch (error) {
      console.error('Error clearing paths:', error);
    }
  }
}

export default PathStorage;
