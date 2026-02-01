"""
Country data with coordinates and mapping between country codes and names
"""

COUNTRIES = [
    {"code": "US", "name": "United States", "lat": 37.0902, "lon": -95.7129, "flag": "🇺🇸"},
    {"code": "GB", "name": "United Kingdom", "lat": 55.3781, "lon": -3.4360, "flag": "🇬🇧"},
    {"code": "DE", "name": "Germany", "lat": 51.1657, "lon": 10.4515, "flag": "🇩🇪"},
    {"code": "FR", "name": "France", "lat": 46.2276, "lon": 2.2137, "flag": "🇫🇷"},
    {"code": "ES", "name": "Spain", "lat": 40.4637, "lon": -3.7492, "flag": "🇪🇸"},
    {"code": "IT", "name": "Italy", "lat": 41.8719, "lon": 12.5674, "flag": "🇮🇹"},
    {"code": "BR", "name": "Brazil", "lat": -14.2350, "lon": -51.9253, "flag": "🇧🇷"},
    {"code": "MX", "name": "Mexico", "lat": 23.6345, "lon": -102.5528, "flag": "🇲🇽"},
    {"code": "CA", "name": "Canada", "lat": 56.1304, "lon": -106.3468, "flag": "🇨🇦"},
    {"code": "AU", "name": "Australia", "lat": -25.2744, "lon": 133.7751, "flag": "🇦🇺"},
    {"code": "JP", "name": "Japan", "lat": 36.2048, "lon": 138.2529, "flag": "🇯🇵"},
    {"code": "TW", "name": "Taiwan", "lat": 23.6978, "lon": 120.9605, "flag": "🇹🇼"},
    {"code": "IN", "name": "India", "lat": 20.5937, "lon": 78.9629, "flag": "🇮🇳"},
    {"code": "SE", "name": "Sweden", "lat": 60.1282, "lon": 18.6435, "flag": "🇸🇪"},
    {"code": "NO", "name": "Norway", "lat": 60.4720, "lon": 8.4689, "flag": "🇳🇴"},
    {"code": "NL", "name": "Netherlands", "lat": 52.1326, "lon": 5.2913, "flag": "🇳🇱"},
    {"code": "PL", "name": "Poland", "lat": 51.9194, "lon": 19.1451, "flag": "🇵🇱"},
    {"code": "AR", "name": "Argentina", "lat": -38.4161, "lon": -63.6167, "flag": "🇦🇷"},
    {"code": "CL", "name": "Chile", "lat": -35.6751, "lon": -71.5430, "flag": "🇨🇱"},
    {"code": "CO", "name": "Colombia", "lat": 4.5709, "lon": -74.2973, "flag": "🇨🇴"},
    {"code": "TH", "name": "Thailand", "lat": 15.8700, "lon": 100.9925, "flag": "🇹🇭"},
    {"code": "SG", "name": "Singapore", "lat": 1.3521, "lon": 103.8198, "flag": "🇸🇬"},
    {"code": "MY", "name": "Malaysia", "lat": 4.2105, "lon": 101.9758, "flag": "🇲🇾"},
    {"code": "PH", "name": "Philippines", "lat": 12.8797, "lon": 121.7740, "flag": "🇵🇭"},
    {"code": "TR", "name": "Turkey", "lat": 38.9637, "lon": 35.2433, "flag": "🇹🇷"},
    {"code": "ZA", "name": "South Africa", "lat": -30.5595, "lon": 22.9375, "flag": "🇿🇦"},
    {"code": "NZ", "name": "New Zealand", "lat": -40.9006, "lon": 174.8860, "flag": "🇳🇿"},
    {"code": "FI", "name": "Finland", "lat": 61.9241, "lon": 25.7482, "flag": "🇫🇮"},
    {"code": "DK", "name": "Denmark", "lat": 56.2639, "lon": 9.5018, "flag": "🇩🇰"},
    {"code": "PT", "name": "Portugal", "lat": 39.3999, "lon": -8.2245, "flag": "🇵🇹"},
    {"code": "GR", "name": "Greece", "lat": 39.0742, "lon": 21.8243, "flag": "🇬🇷"},
    {"code": "IE", "name": "Ireland", "lat": 53.4129, "lon": -8.2439, "flag": "🇮🇪"},
    {"code": "AT", "name": "Austria", "lat": 47.5162, "lon": 14.5501, "flag": "🇦🇹"},
    {"code": "CH", "name": "Switzerland", "lat": 46.8182, "lon": 8.2275, "flag": "🇨🇭"},
    {"code": "BE", "name": "Belgium", "lat": 50.5039, "lon": 4.4699, "flag": "🇧🇪"},
    {"code": "CZ", "name": "Czech Republic", "lat": 49.8175, "lon": 15.4730, "flag": "🇨🇿"},
    {"code": "HU", "name": "Hungary", "lat": 47.1625, "lon": 19.5033, "flag": "🇭🇺"},
    {"code": "RO", "name": "Romania", "lat": 45.9432, "lon": 24.9668, "flag": "🇷🇴"},
    {"code": "ID", "name": "Indonesia", "lat": -0.7893, "lon": 113.9213, "flag": "🇮🇩"},
    {"code": "VN", "name": "Vietnam", "lat": 14.0583, "lon": 108.2772, "flag": "🇻🇳"},
]


def get_country_name(country_code: str) -> str:
    """Get country name from country code"""
    for country in COUNTRIES:
        if country["code"] == country_code:
            return country["name"]
    return country_code
