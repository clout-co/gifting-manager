export interface ROIData {
  overall: {
    totalSpent: number;
    totalLikes: number;
    totalComments: number;
    costPerLike: number;
    costPerComment: number;
    costPerEngagement: number;
    avgCampaignCost: number;
    totalCampaigns: number;
    successRate: number;
  };
  byBrand: {
    brand: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
    roi: number;
  }[];
  byItem: {
    item_code: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
  }[];
  byInfluencer: {
    insta_name: string;
    spent: number;
    likes: number;
    comments: number;
    campaigns: number;
    costPerLike: number;
    efficiency: number;
  }[];
  monthly: {
    month: string;
    spent: number;
    likes: number;
    costPerLike: number;
    campaigns: number;
  }[];
  comparison: {
    current: { spent: number; likes: number; costPerLike: number };
    previous: { spent: number; likes: number; costPerLike: number };
    change: { spent: number; likes: number; costPerLike: number };
  };
}

