/**
 * A `RewardedAdReward` returned from rewarded ads.
 */
export interface RewardedAdReward {
  /**
   * The reward name, e.g. 'coins', 'diamonds'.
   */
  type: string;

  /**
   * The number value of the reward, e.g. 10
   */
  amount: number;
}
