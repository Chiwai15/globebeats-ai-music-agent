// Parse country names and codes from chat messages

export const COUNTRY_MAP = {
  'United States': 'US', 'USA': 'US', 'America': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'Britain': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'New Zealand': 'NZ',
  'Japan': 'JP',
  'South Korea': 'KR', 'Korea': 'KR',
  'China': 'CN',
  'India': 'IN',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'Argentina': 'AR',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Germany': 'DE',
  'France': 'FR',
  'Spain': 'ES',
  'Italy': 'IT',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Switzerland': 'CH',
  'Austria': 'AT',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Poland': 'PL',
  'Czech Republic': 'CZ',
  'Hungary': 'HU',
  'Romania': 'RO',
  'Greece': 'GR',
  'Portugal': 'PT',
  'Ireland': 'IE',
  'Thailand': 'TH',
  'Singapore': 'SG',
  'Malaysia': 'MY',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Vietnam': 'VN',
  'Turkey': 'TR',
  'South Africa': 'ZA'
}

// Find all country mentions in text
export function findCountriesInText(text) {
  const found = new Set()

  // Check for full country names
  Object.keys(COUNTRY_MAP).forEach(countryName => {
    const regex = new RegExp(`\\b${countryName}\\b`, 'gi')
    if (regex.test(text)) {
      found.add(COUNTRY_MAP[countryName])
    }
  })

  // Check for flag emojis (🇺🇸 = US, etc.)
  const flagRegex = /[\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}]/gu
  const flags = text.match(flagRegex)
  if (flags) {
    flags.forEach(flag => {
      const code = flagToCountryCode(flag)
      if (code) found.add(code)
    })
  }

  return Array.from(found)
}

// Convert flag emoji to country code
function flagToCountryCode(flag) {
  const codePoints = [...flag].map(c => c.codePointAt(0))
  if (codePoints.length !== 2) return null

  const code = String.fromCharCode(
    codePoints[0] - 0x1F1E6 + 65,
    codePoints[1] - 0x1F1E6 + 65
  )
  return code
}

// Get country name from code
export function getCountryName(code, countries) {
  const country = countries.find(c => c.country_code === code)
  return country ? country.country_name : code
}
