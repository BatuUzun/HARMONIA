// Buradaki bilgiler demo süreci için. Üretim ortamında backend'e aktarılmalıdır.
const IP_ADDRESS = "http://192.168.0.27"; //TODO: buranın local host ile neden çalışmadığını anlamaya çalışın

//HARMONIA APP

//DEMO APP

export const REDIRECT_URI = "exp://172.20.10.2:8081"; // Geliştirme sırasında kullanılması gereken URI, üretimde değiştirilmelidir

export const AUTH_URL = "https://accounts.spotify.com/authorize";
export const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SCOPES = "user-library-read playlist-read-private user-top-read";

// Backend Services
export const BACKEND_AMAZON_SERVICES_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_API_GATEWAY_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_COMMENT_URL = `${IP_ADDRESS}:8765/api/comment`;
export const BACKEND_CREDENTIALS_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_EMAIL_SENDER_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_FAVORITE_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_PROFILE_API_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_PROFILE_PICTURE_DOWNLOADER_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_REVIEW_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_REVIEW_LIKE_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_SEARCH_PROFILE_URL = `${IP_ADDRESS}:8765`;
export const BACKEND_USER_FOLLOW_URL = `${IP_ADDRESS}:8765`;
export const socketUrl = `${IP_ADDRESS}:8765/ws-chat`;
export const BACKEND_IMAGE_DOWNLOAD_URL = `${IP_ADDRESS}:8765`; // Replace with your actual backend address
export const CONVERSATION_URL = `${IP_ADDRESS}:8765`; // Replace with your actual backend address

// Development or Production
export const IS_DEVELOPMENT = false; // true: Development, false: Production
