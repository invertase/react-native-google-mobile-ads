export interface App {
  name: string;
}

export interface Config {
  namespace: string;
  nativeModuleName: string[];
  nativeEvents: string[];
}

export interface ModuleInterface {
  app: App;
  _config: Config;
  _customUrlOrRegion?: string;
}
