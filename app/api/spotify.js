import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  REDIRECT_URI,
} from "../constants/apiConstants";

// Spotify'dan Access Token almak için Client Credentials Flow
const getAccessToken = async () => {
  const authParameters = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
  };

  try {
    const response = await fetch(TOKEN_URL, authParameters);
    const data = await response.json();
    if (data.access_token) {
      return data.access_token;
    } else {
      console.error("Error fetching access token:", data);
      throw new Error("Failed to retrieve access token");
    }
  } catch (error) {
    console.error("Error in getAccessToken:", error);
    throw error;
  }
};

// Spotify API üzerinden sanatçı aramak
const searchArtists = async (accessToken, query, offset = 0) => {
  const url = `https://api.spotify.com/v1/search?q=${query}&type=artist&limit=10&offset=${offset}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data.artists.items;
};

// Spotify API üzerinden albüm aramak
const searchAlbums = async (accessToken, query, offset = 0) => {
  const url = `https://api.spotify.com/v1/search?q=${query}&type=album&limit=10&offset=${offset}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data.albums.items;
};

export { getAccessToken, searchArtists, searchAlbums };