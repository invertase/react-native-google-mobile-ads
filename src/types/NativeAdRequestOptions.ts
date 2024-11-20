import { RequestOptions } from './RequestOptions';

export enum NativeMediaAspectRatio {
  ANY = 1,
  LANDSCAPE = 2,
  PORTRAIT = 3,
  SQUARE = 4,
}

export interface NativeAdRequestOptions extends RequestOptions {
  aspectRatio?: NativeMediaAspectRatio;
}
