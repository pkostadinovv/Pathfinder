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

  // Generates a unique ID for each path
  private generatePathId() {
    return `path_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Add a new path with a unique ID and optional dots
  addPath(dots: Dot[] = []) {
    const newPath: Path = {
      id: this.generatePathId(),
      dots,
    };
    this.paths.push(newPath);
  }

  // Add a dot to a specific path by ID
  addDotToPath(pathId: string, dot: Dot) {
    const path = this.paths.find((p) => p.id === pathId);
    if (path) {
      path.dots.push(dot);
    }
  }

  // Get all paths
  getPaths() {
    return this.paths;
  }

  // Get a specific path by ID
  getPathById(pathId: string) {
    return this.paths.find((p) => p.id === pathId);
  }

  // Save all paths to AsyncStorage
  async savePaths() {
    try {
      await AsyncStorage.setItem('paths', JSON.stringify(this.paths));
    } catch (error) {
      console.error('Error saving paths to storage:', error);
    }
  }

  // Load paths from AsyncStorage
  async loadPaths() {
    try {
      const storedPaths = await AsyncStorage.getItem('paths');
      this.paths = storedPaths ? JSON.parse(storedPaths) : [];
    } catch (error) {
      console.error('Error loading paths from storage:', error);
    }
  }

  // Clear all paths from memory and AsyncStorage
  async clearPaths() {
    this.paths = [];
    await AsyncStorage.removeItem('paths');
  }
}

export default PathStorage;
