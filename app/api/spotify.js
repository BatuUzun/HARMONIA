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

const getTop50GlobalPlaylist = async (accessToken) => {
  const playlistId = "4i96DEnCkGkhBRcI9SYuc4";
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Spotify API Error: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    console.log("Spotify API Response:", JSON.stringify(data, null, 2)); // Log the full response
    return data.items;
  } catch (error) {
    console.error("Error in getTop50GlobalPlaylist:", error);
    throw error;
  }
};

const getArtistDetails = async (accessToken, artistId) => {
  const url = `https://api.spotify.com/v1/artists/${artistId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data;
};

const getTopArtistsByPopularity = async (accessToken) => {
  try {
    const tracks = await getTop50GlobalPlaylist(accessToken);

    if (!tracks || !Array.isArray(tracks)) {
      throw new Error("Invalid tracks data received from Spotify API");
    }

    // Benzersiz sanatçı ID'lerini çek
    const artistIds = [
      ...new Set(
        tracks.map((item) => item.track?.artists?.[0]?.id).filter(Boolean)
      ),
    ].slice(0, 20); // İlk 20 sanatçıyı al

    if (artistIds.length === 0) return [];

    // **Tek istekte birden fazla sanatçı çekmek için**
    const url = `https://api.spotify.com/v1/artists?ids=${artistIds.join(",")}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Spotify API Error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Sanatçıları popülerliğe göre sırala ve ilk 10'u al
    return data.artists
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
  } catch (error) {
    console.error("Error in getTopArtistsByPopularity:", error);
    return [];
  }
};

export const getArtistAlbums = async (artistId) => {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album&limit=20`;
  const accessToken = await getAccessToken();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  return data.items;
};

export const getAlbumTracks = async (albumId) => {
  const url = `https://api.spotify.com/v1/albums/${albumId}/tracks`;
  const accessToken = await getAccessToken();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  return data.items;
};

export {
  getAccessToken,
  searchArtists,
  searchAlbums,
  getTop50GlobalPlaylist,
  getArtistDetails,
  getTopArtistsByPopularity,
};
