export type NextStopStatus =
  | "not_generated"
  | "generating"
  | "generated"
  | "stale"
  | "failed";

export type RawEvent = Record<string, unknown> & {
  id: string;
  owner_user_id?: string | null;
  route_visible?: boolean | null;
  route_order?: number | null;
  event_theme?: string | null;
  find_me_notes?: string | null;
  appearance_mode?: string | null;
  next_stop_asset_url?: string | null;
  next_stop_asset_status?: NextStopStatus | null;
  next_stop_generated_at?: string | null;
  next_stop_copy?: NextStopCopy | null;
  next_stop_source_hash?: string | null;
  next_stop_background_asset_url?: string | null;
  next_stop_background_asset_path?: string | null;
  next_stop_background_asset_status?: NextStopStatus | null;
  next_stop_background_generated_at?: string | null;
  next_stop_background_prompt?: string | null;
  next_stop_background_image_model?: string | null;
};

export type RouteEvent = {
  id: string;
  ownerUserId: string | null;
  title: string;
  location: string | null;
  stateCode: string | null;
  startAt: string | null;
  endAt: string | null;
  routeVisible: boolean;
  routeOrder: number | null;
  eventTheme: string | null;
  findMeNotes: string | null;
  appearanceMode: string | null;
  raw: RawEvent;
};

export type RouteContext = {
  previous: RouteEvent[];
  current: RouteEvent;
  next: RouteEvent[];
};

export type NextStopCopy = {
  headline: string;
  subheadline: string;
  currentEventKicker: string;
  findMeTitle: string;
  findMeItems: string[];
  flavorText: string;
  pastLabel: string;
  futureLabel: string;
  artDirection: string;
  currentEventTitle: string;
  locationLine: string;
  dateLine: string;
};

export type NextStopState = {
  route: RouteContext;
  sourceHash: string;
  storedSourceHash: string | null;
  status: NextStopStatus;
  stale: boolean;
  imageUrl: string | null;
  generatedAt: string | null;
  copy: NextStopCopy | null;
  backgroundUrl: string | null;
  backgroundPath: string | null;
  backgroundStatus: NextStopStatus;
  backgroundGeneratedAt: string | null;
};

export type GeneratedBackgroundAsset = {
  background: Buffer;
  backgroundUrl: string;
  backgroundPath: string;
  prompt: string;
  imageModel: string;
  imageSize: string;
  copy: NextStopCopy;
};

export type GeneratedAsset = {
  imageUrl: string;
  imagePath: string;
  sourceHash: string;
  copy: NextStopCopy;
  prompt: string;
  imageModel: string;
  imageSize: string;
};
