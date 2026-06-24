export type Quality = 'Auto' | '144p' | '240p' | '360p' | '480p' | '720p' | '1080p';

export type CommentData = {
  id: number;
  author: string;
  avatar: string;
  avatarColor?: string;
  text: string;
  date: string;
  likes: number;
  dislikes: number;
  replies: CommentData[];
};

export type AnimeData = {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  image: string;
  views: number;
  rating: number;
  genres: string[];
  year: number;
  videoSrc: string;
  qualitySources: Partial<Record<Quality, string>>;
  voiceovers: string[];
  comments: CommentData[];
};
