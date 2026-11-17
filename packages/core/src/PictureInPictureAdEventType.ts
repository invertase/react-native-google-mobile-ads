/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * Events specific to {@link PictureInPictureAd} visibility and fullscreen overlays.
 *
 * Picture-in-picture ads are a **Preview** Google open-beta format. See
 * {@link getAdCapabilities} `pictureInPicture` and the format guide.
 */
export enum PictureInPictureAdEventType {
  /** The floating PiP window is on screen. */
  SHOWN = 'shown',
  /** The floating PiP window was hidden or dismissed. */
  HIDDEN = 'hidden',
  /** A fullscreen overlay (for example MRAID expand) will present. */
  WILL_PRESENT_SCREEN = 'will_present_screen',
  /** A fullscreen overlay will dismiss. */
  WILL_DISMISS_SCREEN = 'will_dismiss_screen',
  /** A fullscreen overlay finished dismissing. */
  DID_DISMISS_SCREEN = 'did_dismiss_screen',
}
