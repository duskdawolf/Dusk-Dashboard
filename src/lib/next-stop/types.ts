export type NextStopStatus =
  | "not_generated"
  | "generating"
  | "generated"
  | "stale"
  | "failed";

export type NextStopValidationStatus =
  | "not_run"
  | "passed"
  | "failed"
  | "error";

export type RawEvent = Record<string, unknown> & {
  id: string;
  owner_user_id?: string | null;
  route_visible?: boolean | null;
  route_order?: number | null;
  event_theme?: string | null;
  find_me_notes?: string | null;
  appearance_mode?: string | null;
  suiting_mode?: string | null;

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

  next_stop_allow_ai_wording?: boolean | null;
  next_stop_final_prompt?: string | null;
  next_stop_text_payload?: NextStopPosterText | null;
  next_stop_validation_status?: NextStopValidationStatus | null;
  next_stop_validation_json?: NextStopValidation | null;
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

export type PosterStop = {
  title: string;
  location: string | null;
};

export type NextStopPosterText = {
  mode: "strict" | "creative";
  purpose: string;
  title: string;
  pastLabel: string;
  pastStops: PosterStop[];
  currentLabel: string;
  currentTitle: string;
  currentDate: string;
  currentLocation: string;
  findMeLabel: string;
  findMeItems: string[];
  futureLabel: string;
  futureStops: PosterStop[];
  handle: string;
  exactVisibleLines: string[];
  factLedger: string[];
};

export type NextStopValidation = {
  passed: boolean;
  mode: "strict" | "creative";
  missingText: string[];
  incorrectText: string[];
  factualErrors: string[];
  notes: string;
  attempt: number;
  model: string;
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

  allowAiWording: boolean;
  finalPrompt: string | null;
  textPayload: NextStopPosterText | null;
  validationStatus: NextStopValidationStatus;
  validation: NextStopValidation | null;
};

export type GeneratedBackgroundAsset = {
  background: Buffer;
  backgroundUrl: string;
  backgroundPath: string;
  prompt: string;
  imageModel: string;
  imageSize: string;
  copy: NextStopCopy;
  referenceLabels: string[];
};

export type GeneratedAsset = {
  imageUrl: string;
  imagePath: string;
  sourceHash: string;
  copy: NextStopCopy;
  prompt: string;
  imageModel: string;
  imageSize: string;
  textPayload: NextStopPosterText;
  validation: NextStopValidation;
};
