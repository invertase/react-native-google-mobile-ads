export interface App {
  name: string;
}

export interface Config {
  version: string;
  namespace: string;
  nativeModuleName: string[];
  nativeEvents: string[];
}
