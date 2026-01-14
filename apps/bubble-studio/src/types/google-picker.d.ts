// Type declarations for Google Picker API
// https://developers.google.com/picker/docs

declare namespace google.picker {
  enum Action {
    CANCEL = 'cancel',
    PICKED = 'picked',
  }

  enum ViewId {
    DOCS = 'docs',
    DOCS_IMAGES = 'docs-images',
    DOCS_IMAGES_AND_VIDEOS = 'docs-images-and-videos',
    DOCS_VIDEOS = 'docs-videos',
    DOCUMENTS = 'documents',
    DRAWINGS = 'drawings',
    FOLDERS = 'folders',
    FORMS = 'forms',
    IMAGE_SEARCH = 'image-search',
    MAPS = 'maps',
    PDFS = 'pdfs',
    PHOTOS = 'photos',
    PHOTO_ALBUMS = 'photo-albums',
    PHOTO_UPLOAD = 'photo-upload',
    PRESENTATIONS = 'presentations',
    RECENTLY_PICKED = 'recently-picked',
    SPREADSHEETS = 'spreadsheets',
    VIDEO_SEARCH = 'video-search',
    WEBCAM = 'webcam',
  }

  interface Document {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    iconUrl?: string;
    description?: string;
    type?: string;
    lastEditedUtc?: number;
    sizeBytes?: number;
    parentId?: string;
  }

  interface ResponseObject {
    action: Action;
    docs: Document[];
    viewToken?: string[];
  }

  type PickerCallback = (data: ResponseObject) => void;

  class PickerBuilder {
    addView(viewId: ViewId | View): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setCallback(callback: PickerCallback): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setSize(width: number, height: number): PickerBuilder;
    enableFeature(feature: Feature): PickerBuilder;
    disableFeature(feature: Feature): PickerBuilder;
    build(): Picker;
  }

  class View {
    constructor(viewId: ViewId);
    setMimeTypes(mimeTypes: string): View;
    setQuery(query: string): View;
  }

  class DocsView extends View {
    constructor(viewId?: ViewId);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setOwnedByMe(ownedByMe: boolean): DocsView;
    setStarred(starred: boolean): DocsView;
    setParent(parentId: string): DocsView;
  }

  enum Feature {
    MINE_ONLY = 'mine-only',
    MULTISELECT_ENABLED = 'multiselect-enabled',
    NAV_HIDDEN = 'nav-hidden',
    SIMPLE_UPLOAD_ENABLED = 'simple-upload-enabled',
    SUPPORT_DRIVES = 'support-drives',
  }

  interface Picker {
    setVisible(visible: boolean): void;
    dispose(): void;
  }
}

declare namespace gapi {
  function load(
    api: string,
    callback: { callback: () => void; onerror?: () => void }
  ): void;
  function load(api: string, callback: () => void): void;
}

interface Window {
  google?: typeof google;
  gapi?: typeof gapi;
}
