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

export enum MaxAdContentRating {
  /**
   * "General audiences." Content suitable for all audiences, including families and children.
   */
  G = 'G',

  /**
   * "Parental guidance." Content suitable for most audiences with parental guidance, including topics like non-realistic, cartoonish violence.
   */
  PG = 'PG',

  /**
   * T: "Teen." Content suitable for teen and older audiences, including topics such as general health, social networks, scary imagery, and fight sports.
   */
  T = 'T',

  /**
   * "Mature audiences." Content suitable only for mature audiences; includes topics such as alcohol, gambling, sexual content, and weapons.
   */
  MA = 'MA',
}
