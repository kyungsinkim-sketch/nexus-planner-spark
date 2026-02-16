/**
 * Weather Client for Brain AI — Uses Open-Meteo (free, no API key)
 *
 * Provides weather forecast data for Korean locations.
 * Used by brain-process to inject real weather context into LLM prompts.
 */

// ─── Korean Location → Coordinates Mapping ────────────────────────────────────
// Common Korean filming/production locations with lat/lon
const KNOWN_LOCATIONS: Record<string, { lat: number; lon: number; nameKo: string; nameEn: string }> = {
  // Major cities
  '서울': { lat: 37.5665, lon: 126.978, nameKo: '서울', nameEn: 'Seoul' },
  '부산': { lat: 35.1796, lon: 129.0756, nameKo: '부산', nameEn: 'Busan' },
  '인천': { lat: 37.4563, lon: 126.7052, nameKo: '인천', nameEn: 'Incheon' },
  '대구': { lat: 35.8714, lon: 128.6014, nameKo: '대구', nameEn: 'Daegu' },
  '대전': { lat: 36.3504, lon: 127.3845, nameKo: '대전', nameEn: 'Daejeon' },
  '광주': { lat: 35.1595, lon: 126.8526, nameKo: '광주', nameEn: 'Gwangju' },
  '울산': { lat: 35.5384, lon: 129.3114, nameKo: '울산', nameEn: 'Ulsan' },
  '세종': { lat: 36.48, lon: 127.2551, nameKo: '세종', nameEn: 'Sejong' },

  // Jeju
  '제주': { lat: 33.4996, lon: 126.5312, nameKo: '제주', nameEn: 'Jeju' },
  '제주도': { lat: 33.4996, lon: 126.5312, nameKo: '제주도', nameEn: 'Jeju Island' },
  '성산포': { lat: 33.4612, lon: 126.9271, nameKo: '성산포', nameEn: 'Seongsan-po' },
  '성산': { lat: 33.4612, lon: 126.9271, nameKo: '성산', nameEn: 'Seongsan' },
  '서귀포': { lat: 33.2541, lon: 126.56, nameKo: '서귀포', nameEn: 'Seogwipo' },
  '중문': { lat: 33.2478, lon: 126.4121, nameKo: '중문', nameEn: 'Jungmun' },
  '우도': { lat: 33.5044, lon: 126.9528, nameKo: '우도', nameEn: 'Udo Island' },
  '한라산': { lat: 33.3617, lon: 126.5292, nameKo: '한라산', nameEn: 'Hallasan' },
  '협재': { lat: 33.394, lon: 126.2396, nameKo: '협재', nameEn: 'Hyeopjae' },

  // Gyeonggi
  '수원': { lat: 37.2636, lon: 127.0286, nameKo: '수원', nameEn: 'Suwon' },
  '파주': { lat: 37.759, lon: 126.7802, nameKo: '파주', nameEn: 'Paju' },
  '양평': { lat: 37.4917, lon: 127.4877, nameKo: '양평', nameEn: 'Yangpyeong' },
  '가평': { lat: 37.8315, lon: 127.5095, nameKo: '가평', nameEn: 'Gapyeong' },
  '용인': { lat: 37.2411, lon: 127.1776, nameKo: '용인', nameEn: 'Yongin' },

  // Gangwon
  '강릉': { lat: 37.7519, lon: 128.8761, nameKo: '강릉', nameEn: 'Gangneung' },
  '속초': { lat: 38.207, lon: 128.5918, nameKo: '속초', nameEn: 'Sokcho' },
  '춘천': { lat: 37.8813, lon: 127.7298, nameKo: '춘천', nameEn: 'Chuncheon' },
  '평창': { lat: 37.3704, lon: 128.3906, nameKo: '평창', nameEn: 'Pyeongchang' },
  '정선': { lat: 37.3809, lon: 128.6608, nameKo: '정선', nameEn: 'Jeongseon' },

  // Chungcheong
  '공주': { lat: 36.4467, lon: 127.119, nameKo: '공주', nameEn: 'Gongju' },
  '부여': { lat: 36.2756, lon: 126.9098, nameKo: '부여', nameEn: 'Buyeo' },
  '천안': { lat: 36.8151, lon: 127.1139, nameKo: '천안', nameEn: 'Cheonan' },
  '청주': { lat: 36.6424, lon: 127.489, nameKo: '청주', nameEn: 'Cheongju' },

  // Jeolla
  '전주': { lat: 35.8242, lon: 127.148, nameKo: '전주', nameEn: 'Jeonju' },
  '여수': { lat: 34.7604, lon: 127.6622, nameKo: '여수', nameEn: 'Yeosu' },
  '순천': { lat: 34.9506, lon: 127.4875, nameKo: '순천', nameEn: 'Suncheon' },
  '목포': { lat: 34.8118, lon: 126.3922, nameKo: '목포', nameEn: 'Mokpo' },
  '담양': { lat: 35.3212, lon: 126.9882, nameKo: '담양', nameEn: 'Damyang' },

  // Gyeongsang
  '경주': { lat: 35.8562, lon: 129.2247, nameKo: '경주', nameEn: 'Gyeongju' },
  '안동': { lat: 36.5684, lon: 128.7226, nameKo: '안동', nameEn: 'Andong' },
  '통영': { lat: 34.8544, lon: 128.4336, nameKo: '통영', nameEn: 'Tongyeong' },
  '거제': { lat: 34.8806, lon: 128.6212, nameKo: '거제', nameEn: 'Geoje' },
  '포항': { lat: 36.019, lon: 129.3435, nameKo: '포항', nameEn: 'Pohang' },

  // Seoul neighborhoods (filming locations)
  '홍대': { lat: 37.5563, lon: 126.9237, nameKo: '홍대', nameEn: 'Hongdae' },
  '이태원': { lat: 37.5345, lon: 126.9945, nameKo: '이태원', nameEn: 'Itaewon' },
  '강남': { lat: 37.4979, lon: 127.0276, nameKo: '강남', nameEn: 'Gangnam' },
  '명동': { lat: 37.5636, lon: 126.9869, nameKo: '명동', nameEn: 'Myeongdong' },
  '삼청동': { lat: 37.5838, lon: 126.982, nameKo: '삼청동', nameEn: 'Samcheong-dong' },
  '북촌': { lat: 37.5826, lon: 126.9849, nameKo: '북촌', nameEn: 'Bukchon' },
  '여의도': { lat: 37.5256, lon: 126.9256, nameKo: '여의도', nameEn: 'Yeouido' },
  '잠실': { lat: 37.5133, lon: 127.1, nameKo: '잠실', nameEn: 'Jamsil' },
  '합정': { lat: 37.5496, lon: 126.9138, nameKo: '합정', nameEn: 'Hapjeong' },
  '성수': { lat: 37.5445, lon: 127.056, nameKo: '성수', nameEn: 'Seongsu' },
  '을지로': { lat: 37.5662, lon: 126.9916, nameKo: '을지로', nameEn: 'Euljiro' },
  '대학로': { lat: 37.5812, lon: 127.0017, nameKo: '대학로', nameEn: 'Daehak-ro' },
  '삼각지': { lat: 37.5346, lon: 126.9728, nameKo: '삼각지', nameEn: 'Samgakji' },
};

/**
 * Resolve a Korean location name to lat/lon coordinates.
 * First checks local mapping, then falls back to Nominatim geocoding.
 */
export async function resolveLocation(
  locationName: string,
): Promise<{ lat: number; lon: number; resolvedName: string } | null> {
  // 1. Check known locations (exact match first)
  const normalized = locationName.trim();
  if (KNOWN_LOCATIONS[normalized]) {
    const loc = KNOWN_LOCATIONS[normalized];
    return { lat: loc.lat, lon: loc.lon, resolvedName: loc.nameKo };
  }

  // 2. Check partial match (e.g., "제주도 성산포" contains "성산포")
  for (const [key, loc] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized.includes(key)) {
      return { lat: loc.lat, lon: loc.lon, resolvedName: loc.nameKo };
    }
  }

  // 3. Fallback: Nominatim geocoding (free, no key needed)
  try {
    const query = encodeURIComponent(`${normalized}, South Korea`);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=kr`,
      { headers: { 'User-Agent': 'Re-Be-Brain/1.0' } },
    );
    if (resp.ok) {
      const results = await resp.json();
      if (results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lon: parseFloat(results[0].lon),
          resolvedName: results[0].display_name.split(',')[0],
        };
      }
    }
  } catch (err) {
    console.error('Nominatim geocoding failed:', err);
  }

  return null;
}

// ─── Weather Code Descriptions ─────────────────────────────────────────────────
const WEATHER_CODES: Record<number, { ko: string; en: string; emoji: string }> = {
  0: { ko: '맑음', en: 'Clear sky', emoji: '☀️' },
  1: { ko: '대체로 맑음', en: 'Mainly clear', emoji: '🌤️' },
  2: { ko: '부분적 흐림', en: 'Partly cloudy', emoji: '⛅' },
  3: { ko: '흐림', en: 'Overcast', emoji: '☁️' },
  45: { ko: '안개', en: 'Fog', emoji: '🌫️' },
  48: { ko: '서리 안개', en: 'Rime fog', emoji: '🌫️' },
  51: { ko: '약한 이슬비', en: 'Light drizzle', emoji: '🌦️' },
  53: { ko: '보통 이슬비', en: 'Moderate drizzle', emoji: '🌦️' },
  55: { ko: '강한 이슬비', en: 'Dense drizzle', emoji: '🌧️' },
  61: { ko: '약한 비', en: 'Slight rain', emoji: '🌧️' },
  63: { ko: '보통 비', en: 'Moderate rain', emoji: '🌧️' },
  65: { ko: '강한 비', en: 'Heavy rain', emoji: '🌧️' },
  66: { ko: '약한 진눈깨비', en: 'Light freezing rain', emoji: '🌨️' },
  67: { ko: '강한 진눈깨비', en: 'Heavy freezing rain', emoji: '🌨️' },
  71: { ko: '약한 눈', en: 'Slight snow', emoji: '🌨️' },
  73: { ko: '보통 눈', en: 'Moderate snow', emoji: '❄️' },
  75: { ko: '강한 눈', en: 'Heavy snow', emoji: '❄️' },
  77: { ko: '싸락눈', en: 'Snow grains', emoji: '🌨️' },
  80: { ko: '약한 소나기', en: 'Slight rain showers', emoji: '🌦️' },
  81: { ko: '보통 소나기', en: 'Moderate rain showers', emoji: '🌧️' },
  82: { ko: '강한 소나기', en: 'Violent rain showers', emoji: '⛈️' },
  85: { ko: '약한 눈 소나기', en: 'Slight snow showers', emoji: '🌨️' },
  86: { ko: '강한 눈 소나기', en: 'Heavy snow showers', emoji: '❄️' },
  95: { ko: '뇌우', en: 'Thunderstorm', emoji: '⛈️' },
  96: { ko: '우박 뇌우', en: 'Thunderstorm with hail', emoji: '⛈️' },
  99: { ko: '강한 우박 뇌우', en: 'Thunderstorm with heavy hail', emoji: '⛈️' },
};

function getWeatherDescription(code: number): { ko: string; en: string; emoji: string } {
  return WEATHER_CODES[code] || { ko: `기상코드 ${code}`, en: `Code ${code}`, emoji: '🌡️' };
}

// ─── Open-Meteo API ────────────────────────────────────────────────────────────

export interface WeatherForecast {
  locationName: string;
  date: string;
  temperature: { min: number; max: number };
  apparentTemperature: { min: number; max: number };
  weatherCode: number;
  weatherDescription: { ko: string; en: string; emoji: string };
  precipitation: { sum: number; probability: number };
  windSpeed: number;  // max km/h
  windGusts: number;  // max km/h
  windDirection: number;  // dominant degrees
  visibility: number;  // km (estimated from weather code)
  humidity: { min: number; max: number };
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  // Hourly details for the day (key hours)
  hourly?: HourlyForecast[];
}

export interface HourlyForecast {
  time: string;  // HH:MM
  temperature: number;
  weatherCode: number;
  weatherEmoji: string;
  weatherKo: string;
  windSpeed: number;
  windGusts: number;
  humidity: number;
  visibility: number;  // km
  precipitation: number;
}

/**
 * Fetch weather forecast from Open-Meteo for a specific date and location.
 * Returns null if the date is too far in the future (>16 days) or API fails.
 */
export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  date: string,  // YYYY-MM-DD
  locationName: string,
): Promise<WeatherForecast | null> {
  try {
    // Open-Meteo supports up to 16 days forecast
    const today = new Date();
    const targetDate = new Date(date);
    const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 16) {
      return null;  // Too far in the future
    }

    // Fetch daily + hourly data
    const dailyParams = [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min',
      'precipitation_sum', 'precipitation_probability_max',
      'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
      'sunrise', 'sunset', 'uv_index_max',
      'relative_humidity_2m_max', 'relative_humidity_2m_min',
    ].join(',');

    const hourlyParams = [
      'temperature_2m', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m',
      'relative_humidity_2m', 'visibility', 'precipitation',
    ].join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&daily=${dailyParams}&hourly=${hourlyParams}`
      + `&start_date=${date}&end_date=${date}`
      + `&timezone=Asia/Seoul&wind_speed_unit=kmh`;

    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Open-Meteo API error: ${resp.status} ${await resp.text()}`);
      return null;
    }

    const data = await resp.json();

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      return null;
    }

    const d = data.daily;
    const weatherCode = d.weather_code[0];
    const weatherDesc = getWeatherDescription(weatherCode);

    // Parse hourly data for key hours (6am, 9am, 12pm, 3pm, 6pm, 9pm)
    const keyHours = [6, 9, 12, 15, 18, 21];
    const hourlyForecasts: HourlyForecast[] = [];

    if (data.hourly && data.hourly.time) {
      for (let i = 0; i < data.hourly.time.length; i++) {
        const hourStr = data.hourly.time[i];
        const hour = new Date(hourStr).getHours();
        if (keyHours.includes(hour)) {
          const hCode = data.hourly.weather_code[i];
          const hDesc = getWeatherDescription(hCode);
          hourlyForecasts.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            temperature: data.hourly.temperature_2m[i],
            weatherCode: hCode,
            weatherEmoji: hDesc.emoji,
            weatherKo: hDesc.ko,
            windSpeed: data.hourly.wind_speed_10m[i],
            windGusts: data.hourly.wind_gusts_10m[i],
            humidity: data.hourly.relative_humidity_2m[i],
            visibility: Math.round((data.hourly.visibility[i] || 10000) / 1000 * 10) / 10,  // m → km
            precipitation: data.hourly.precipitation[i],
          });
        }
      }
    }

    // Estimate visibility from weather code (Open-Meteo daily doesn't include visibility directly)
    let estimatedVisibility = 10; // km, default good
    if (weatherCode >= 45 && weatherCode <= 48) estimatedVisibility = 1; // fog
    else if (weatherCode >= 61 && weatherCode <= 67) estimatedVisibility = 5; // rain
    else if (weatherCode >= 71 && weatherCode <= 77) estimatedVisibility = 3; // snow
    else if (weatherCode >= 80 && weatherCode <= 82) estimatedVisibility = 6; // showers
    else if (weatherCode >= 95) estimatedVisibility = 4; // thunderstorm
    // Use hourly visibility average if available
    if (hourlyForecasts.length > 0) {
      const avgVis = hourlyForecasts.reduce((sum, h) => sum + h.visibility, 0) / hourlyForecasts.length;
      estimatedVisibility = Math.round(avgVis * 10) / 10;
    }

    return {
      locationName,
      date,
      temperature: { min: d.temperature_2m_min[0], max: d.temperature_2m_max[0] },
      apparentTemperature: { min: d.apparent_temperature_min[0], max: d.apparent_temperature_max[0] },
      weatherCode,
      weatherDescription: weatherDesc,
      precipitation: {
        sum: d.precipitation_sum[0],
        probability: d.precipitation_probability_max[0],
      },
      windSpeed: d.wind_speed_10m_max[0],
      windGusts: d.wind_gusts_10m_max[0],
      windDirection: d.wind_direction_10m_dominant[0],
      visibility: estimatedVisibility,
      humidity: {
        min: d.relative_humidity_2m_min[0],
        max: d.relative_humidity_2m_max[0],
      },
      sunrise: d.sunrise[0],
      sunset: d.sunset[0],
      uvIndexMax: d.uv_index_max[0],
      hourly: hourlyForecasts,
    };
  } catch (err) {
    console.error('Failed to fetch weather:', err);
    return null;
  }
}

/**
 * Format a WeatherForecast into a human-readable Korean context string
 * for injection into the LLM system prompt.
 */
export function formatWeatherContext(forecast: WeatherForecast): string {
  const { weatherDescription, temperature, apparentTemperature, windSpeed, windGusts, visibility, precipitation, humidity, sunrise, sunset, uvIndexMax, hourly } = forecast;

  let text = `\n## 실시간 날씨 데이터 (Open-Meteo 예보)
📍 위치: ${forecast.locationName}
📅 날짜: ${forecast.date}

### 종합 예보
- 날씨: ${weatherDescription.emoji} ${weatherDescription.ko}
- 기온: ${temperature.min}°C ~ ${temperature.max}°C (체감: ${apparentTemperature.min}°C ~ ${apparentTemperature.max}°C)
- 강수확률: ${precipitation.probability}% | 강수량: ${precipitation.sum}mm
- 풍속: 최대 ${windSpeed} km/h | 돌풍: 최대 ${windGusts} km/h
- 시정(가시거리): 약 ${visibility} km
- 습도: ${humidity.min}% ~ ${humidity.max}%
- UV 지수: ${uvIndexMax}
- 일출: ${sunrise ? new Date(sunrise).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
- 일몰: ${sunset ? new Date(sunset).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }) : 'N/A'}`;

  if (hourly && hourly.length > 0) {
    text += `\n\n### 시간별 상세 예보`;
    for (const h of hourly) {
      text += `\n- ${h.time}: ${h.weatherEmoji} ${h.weatherKo}, ${h.temperature}°C, 풍속 ${h.windSpeed}km/h(돌풍 ${h.windGusts}km/h), 시정 ${h.visibility}km, 습도 ${h.humidity}%, 강수 ${h.precipitation}mm`;
    }
  }

  return text;
}

// ─── Weather Intent Detection ──────────────────────────────────────────────────

/**
 * Detect if a message is asking about weather and extract location + date info.
 * Returns null if no weather intent detected.
 */
export function detectWeatherIntent(
  message: string,
): { locationHint: string; dateHint: string | null } | null {
  // Korean weather keywords
  const weatherKeywords = [
    '날씨', '기온', '온도', '비', '눈', '바람', '풍속', '시정', '가시거리',
    '강수', '습도', '체감온도', '일출', '일몰', '자외선', 'UV',
    '기상', '예보', '우천', '폭우', '폭설', '안개', '미세먼지',
    '촬영 날씨', '야외 촬영', 'weather', 'forecast',
    '맑', '흐림', '구름',
  ];

  const hasWeatherIntent = weatherKeywords.some((kw) => message.includes(kw));
  if (!hasWeatherIntent) return null;

  // Extract location — look for known location names in the message
  let locationHint = '';
  // Check known locations (longest match first to prefer "성산포" over "성산")
  const sortedKeys = Object.keys(KNOWN_LOCATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (message.includes(key)) {
      locationHint = key;
      break;
    }
  }

  // If no known location, try to extract location after common patterns
  if (!locationHint) {
    const locPatterns = [
      /(?:에서|의|지역|근처|쪽)\s*날씨/,
      /(\S+)\s*(?:날씨|기온|풍속|시정)/,
      /날씨.*?(\S+(?:시|군|구|동|도|포|읍|면))/,
    ];
    for (const pat of locPatterns) {
      const m = message.match(pat);
      if (m && m[1]) {
        locationHint = m[1];
        break;
      }
    }
  }

  // Extract date hint
  let dateHint: string | null = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Specific date patterns: X월 Y일
  const dateMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const year = today.getFullYear();
    const d = new Date(year, month - 1, day);
    // If the date is in the past, try next year
    if (d < today) {
      d.setFullYear(year + 1);
    }
    dateHint = d.toISOString().split('T')[0];
  }

  // Relative date patterns
  if (!dateHint) {
    const relativePatterns: [RegExp, number][] = [
      [/오늘/, 0],
      [/내일/, 1],
      [/모레|내일\s*모레/, 2],
      [/글피/, 3],
    ];
    for (const [pat, offset] of relativePatterns) {
      if (pat.test(message)) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        dateHint = d.toISOString().split('T')[0];
        break;
      }
    }
  }

  // Day of week patterns
  if (!dateHint) {
    const dayNames: Record<string, number> = {
      '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4,
      '금요일': 5, '토요일': 6, '일요일': 0,
    };
    for (const [name, dayNum] of Object.entries(dayNames)) {
      if (message.includes(name)) {
        const d = new Date(today);
        const currentDay = d.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        if (message.includes('다음주') || message.includes('다음 주')) {
          diff += 7;
        }
        d.setDate(d.getDate() + diff);
        dateHint = d.toISOString().split('T')[0];
        break;
      }
    }
  }

  // Default to today if no date found
  if (!dateHint) {
    dateHint = today.toISOString().split('T')[0];
  }

  return { locationHint: locationHint || '서울', dateHint };
}
