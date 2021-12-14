/**
 * The MaxAdContentRating interface used when setting global advert request options.
 */
export interface MaxAdContentRating {
  /**
   * "General audiences." Content suitable for all audiences, including families and children.
   */
  G: 'G';

  /**
   * "Parental guidance." Content suitable for most audiences with parental guidance, including topics like non-realistic, cartoonish violence.
   */
  PG: 'PG';

  /**
   * T: "Teen." Content suitable for teen and older audiences, including topics such as general health, social networks, scary imagery, and fight sports.
   */
  T: 'T';

  /**
   * "Mature audiences." Content suitable only for mature audiences; includes topics such as alcohol, gambling, sexual content, and weapons.
   */
  MA: 'MA';
}
