export type BookFormat =
  | "hardcover"
  | "paperback"
  | "pocket"
  | "ebook"
  | "audiobook"
  | "box"
  | "other";

export type ShelfKind = "physical" | "digital" | "audio";

export type OwnershipStatus =
  "owned" | "borrowed" | "lent" | "sold" | "donated" | "lost";

export type ReadingStatus =
  "not_started" | "reading" | "paused" | "finished" | "abandoned";

export type ProgressUnit = "pages" | "percent" | "seconds";

export type ContributorRole =
  "author" | "translator" | "illustrator" | "narrator" | "editor" | "organizer";

export type GoalKind = "books" | "pages";

export type GoalPeriod = "year" | "month";

export type WishStatus = "wanted" | "purchased" | "dropped";

export type {
  DensityPreference,
  MotionPreference,
  ThemeId,
  ThemePreference,
} from "@/lib/themes/themes.types";

import type {
  DensityPreference,
  MotionPreference,
  ThemePreference,
} from "@/lib/themes/themes.types";

export type ThreeDPreference = "auto" | "on" | "off";

export interface Contributor {
  name: string;
  role: ContributorRole;
}

export interface Work {
  id: string;
  ownerId: string | null;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  firstPublishedYear?: number;
  description?: string;
  primaryGenre?: string;
  contributors: Contributor[];
  fingerprint: string;
  source: "manual" | "brasilapi" | "google_books" | "open_library" | "import";
  createdAt: string;
}

export type BookCoverSource =
  "brasilapi" | "google" | "openlibrary" | "hardcover" | "apple" | "upload";

export interface Edition {
  id: string;
  workId: string;
  ownerId: string | null;
  isbn13?: string;
  isbn10?: string;
  title: string;
  subtitle?: string;
  publisher?: string;
  language: string;
  format: BookFormat;
  pages?: number;
  durationSeconds?: number;
  publishedOn?: string;
  editionLabel?: string;
  heightMm?: number;
  widthMm?: number;
  thicknessMm?: number;
  coverUrl?: string;
  coverSource?: BookCoverSource | null;
  coverColor?: string;
  coverAccentColor?: string;
  contributors: Contributor[];
  source: "manual" | "brasilapi" | "google_books" | "open_library" | "import";
  createdAt: string;
}

export interface Shelf {
  id: string;
  userId: string;
  name: string;
  kind: ShelfKind;
  sortMode: "manual" | "title" | "author" | "acquired" | "finished";
  position: number;
}

export interface LibraryItem {
  id: string;
  userId: string;
  editionId: string;
  shelfId: string;
  shelfPosition: number;
  status: OwnershipStatus;
  acquiredOn?: string;
  pricePaid?: number;
  currency: string;
  store?: string;
  condition?: "new" | "good" | "worn" | "damaged";
  notes?: string;
  importBatchId?: string;
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  workId: string;
  editionId?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  targetPrice?: number;
  currency: string;
  whereToBuy?: string;
  notes?: string;
  status: WishStatus;
  resolvedAt?: string;
  libraryItemId?: string;
  createdAt: string;
}

export interface Reading {
  id: string;
  userId: string;
  workId: string;
  editionId?: string;
  libraryItemId?: string;
  format: BookFormat;
  status: ReadingStatus;
  startedOn?: string;
  finishedOn?: string;
  progressUnit: ProgressUnit;
  progressValue: number;
  progressTotal?: number;
  dailyLogs?: Array<{
    ymd: string;
    pages?: number;
    seconds?: number;
  }>;
  countsForGoals: boolean;
  notes?: string;
  abandonReason?: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  userId: string;
  workId: string;
  rating: number;
  narrationRating?: number;
  body?: string;
  isPrivate: boolean;
  importBatchId?: string;
  updatedAt: string;
}

export interface ReadingGoal {
  id: string;
  userId: string;
  title: string;
  kind: GoalKind;
  period: GoalPeriod;
  startsOn: string;
  endsOn: string;
  targetValue: number;
  tolerancePercent: number;
  countRereads: boolean;
  formats?: BookFormat[];
  createdAt: string;
}

export interface ImportPendingItem {
  rowNumber: number;
  rawTitle: string;
  rawAuthor: string;
  rawIsbn?: string;
  reason: string;
}

export interface ImportJob {
  id: string;
  userId: string;
  source: "template" | "goodreads";
  status: "done" | "rolled_back";
  totalRows: number;
  importedRows: number;
  skippedDuplicates: number;
  failedRows: number;
  pendingReview: ImportPendingItem[];
  createdWorkIds: string[];
  createdEditionIds: string[];
  createdItemIds: string[];
  createdReadingIds: string[];
  createdReviewIds: string[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  locale: "pt-BR";
  timezone: string;
  defaultCurrency: "BRL" | "USD" | "EUR";
  theme: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
  threeD: ThreeDPreference;
  goalsCountRereads: boolean;
  maxSimultaneousReadings: number;
  telemetryOptOut: boolean;
  onboardingCompleted: boolean;
  onboardingGoal?: "organize" | "read_more" | "track_formats";
  preferredFormats: ShelfKind[];
  acceptedTermsVersion: string;
  acceptedTermsAt: string;
}
