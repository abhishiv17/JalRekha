"""Plot Check verdict: a fixed rule sets the level, Claude explains it.

The level (high / watch / low) comes from the satellite facts alone, so the
same spot always gets the same answer. Claude on Amazon Bedrock writes the
plain-language explanation in English, Kannada, Telugu and Hindi from those
facts; if Bedrock is unavailable, short fixed templates are used instead.
"""

import json
import os

LANGUAGES = ("en", "kn", "te", "hi")
MODEL = os.environ.get("BEDROCK_MODEL", "anthropic.claude-opus-5-5")
REGION = os.environ.get("BEDROCK_REGION", "us-west-2")

MIN_DRY_SEASONS = 3  # fewer clear dry seasons than this: say so, don't guess


def reasons(facts: dict) -> list[dict]:
    """Every finding that raises the level, most serious first."""
    out = []
    dry = facts["dry_seasons_with_water"]
    if dry:
        out.append({"code": "lake_bed", "level": "high", "seasons": dry})
    for f in facts["floods"]:
        if f["flooded_at_pin"]:
            out.append({"code": "flooded", "level": "high", "event": f["name"], "date": f["date"]})
    for rule in facts["buffer_rules"]:
        if rule["inside"] and rule["status"] == "in_force":
            out.append({"code": "in_buffer", "level": "high", "width_m": rule["width_m"], "rule": rule["rule"],
                        "distance_m": facts["distance_to_extent_m"]})
    for rule in facts["buffer_rules"]:
        if rule["inside"] and rule["status"] != "in_force":
            out.append({"code": "in_buffer_other", "level": "watch", "width_m": rule["width_m"], "rule": rule["rule"],
                        "distance_m": facts["distance_to_extent_m"]})
    post = [s for s in facts["post_seasons_with_water"] if s.replace("post", "dry") not in dry]
    if post:
        out.append({"code": "wet_after_monsoon", "level": "watch", "seasons": post})
    d = facts["distance_to_extent_m"]
    if d is not None and 0 < d <= 100 and not any(r["code"] == "in_buffer" for r in out):
        out.append({"code": "near_lake", "level": "watch", "distance_m": d})
    for f in facts["floods"]:
        if not f["flooded_at_pin"] and (f["share_flooded_250m"] or 0) >= 0.05:
            out.append({"code": "flood_nearby", "level": "watch", "event": f["name"], "date": f["date"],
                        "share": f["share_flooded_250m"]})
    return out


def level(facts: dict, found: list[dict]) -> str:
    if any(r["level"] == "high" for r in found):
        return "high"
    if facts["dry_seasons_checked"] < MIN_DRY_SEASONS:
        return "unknown"
    return "watch" if found else "low"


# --- Explanation -------------------------------------------------------------

SYSTEM = """You explain satellite water-history checks to people in India who are about to buy or rent a home or plot.

Write for a family, not an engineer: short sentences, no jargon, no index names. Use only the facts you are given; never add places, numbers, laws or history that are not in them. The risk level is already decided: explain it, never change it.

Be careful with claims: this is satellite evidence of where water has been, measured from the water's edge seen from space. It is not a land survey, not the legal lake boundary (FTL) and not proof that anything is illegal. Never call a property illegal or safe; say what the satellite saw and what to check before paying.

Seasons are written like "2021-dry" (January to April 2021) and "2021-post" (November to December 2021, after the monsoon).

Write every language natively, not as a word-for-word translation: English (en), Kannada (kn), Telugu (te), Hindi (hi). Keep numbers as digits.

Reply with one JSON object and nothing else, shaped like this for each of "en", "kn", "te", "hi":
{"en": {"headline": "one-sentence verdict, under 15 words", "summary": "2 to 4 short sentences: what the satellite saw here and why it matters", "checks": ["2 to 4 concrete things to ask or verify before paying"]}, ...}"""

def _prompt(facts: dict, lvl: str, found: list[dict]) -> str:
    brief = {
        "risk_level": lvl,
        "reasons": found,
        "dry_seasons_checked": facts["dry_seasons_checked"],
        "distance_to_lake_water_m": facts["distance_to_extent_m"],
        "pin_is_on_lake_water_extent": facts["in_lake_bed"],
        "nearest_lake": facts["nearest_lake"],
        "buffer_rules": facts["buffer_rules"],
        "flood_events_checked": [{k: f[k] for k in ("name", "date", "flooded_at_pin", "share_flooded_250m")}
                                 for f in facts["floods"]],
        "address": facts.get("address"),
    }
    return "Explain this Plot Check result.\n\n" + json.dumps(brief, ensure_ascii=False, indent=2)


def explain_with_claude(facts: dict, lvl: str, found: list[dict]) -> dict:
    from anthropic import AnthropicBedrockMantle

    client = AnthropicBedrockMantle(aws_region=REGION)
    response = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": _prompt(facts, lvl, found)}],
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stop_reason {response.stop_reason}")
    text = "".join(b.text for b in response.content if b.type == "text")
    return _parse(text)


def _parse(text: str) -> dict:
    """The JSON object in Claude's reply, checked against the shape we asked for.

    Claude in Amazon Bedrock has no structured outputs, so validate here.
    """
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    for lang in LANGUAGES:
        part = data[lang]
        if not (isinstance(part.get("headline"), str) and isinstance(part.get("summary"), str)
                and isinstance(part.get("checks"), list) and all(isinstance(c, str) for c in part["checks"])):
            raise ValueError(f"reply for {lang!r} is missing fields")
    return {lang: {k: data[lang][k] for k in ("headline", "summary", "checks")} for lang in LANGUAGES}


# Fixed fallback text. Kept short and literal on purpose.
_T = {
    "en": {
        "high": "High risk: satellites saw water at or right next to this spot.",
        "watch": "Watch: this spot is close to water or got wet after the monsoon.",
        "low": "Low risk: no open water seen here in the satellite record since 2019.",
        "unknown": "Not enough clear satellite images here to judge.",
        "lake_bed": "Open lake water covered this spot in {n} dry season(s): {seasons}.",
        "flooded": "Flooding was seen at this spot on {date} ({event}).",
        "in_buffer": "It is {distance_m} m from the lake's water edge, inside the {width_m} m buffer.",
        "in_buffer_other": "It is {distance_m} m from the lake's water edge, inside a proposed {width_m} m buffer.",
        "wet_after_monsoon": "The ground here held water after the monsoon in {seasons}.",
        "near_lake": "The lake's largest water extent is {distance_m} m away.",
        "flood_nearby": "{pct}% of the area within 250 m flooded on {date} ({event}).",
        "none": "The satellite record shows no open water here since 2019.",
        "checks": [
            "Ask for the survey number and check it against the lake and buffer maps of the planning authority.",
            "Ask neighbours whether the street floods during heavy rain.",
            "Get the occupancy certificate and approved plan, and have a lawyer verify them.",
        ],
    },
    "kn": {
        "high": "ಹೆಚ್ಚಿನ ಅಪಾಯ: ಈ ಸ್ಥಳದಲ್ಲಿ ಅಥವಾ ಪಕ್ಕದಲ್ಲೇ ಉಪಗ್ರಹಗಳು ನೀರನ್ನು ಕಂಡಿವೆ.",
        "watch": "ಗಮನಿಸಿ: ಈ ಸ್ಥಳ ನೀರಿಗೆ ಹತ್ತಿರವಿದೆ ಅಥವಾ ಮಳೆಗಾಲದ ನಂತರ ಒದ್ದೆಯಾಗಿತ್ತು.",
        "low": "ಕಡಿಮೆ ಅಪಾಯ: 2019 ರಿಂದ ಉಪಗ್ರಹ ದಾಖಲೆಯಲ್ಲಿ ಇಲ್ಲಿ ತೆರೆದ ನೀರು ಕಾಣಿಸಿಲ್ಲ.",
        "unknown": "ತೀರ್ಮಾನಿಸಲು ಇಲ್ಲಿ ಸಾಕಷ್ಟು ಸ್ಪಷ್ಟ ಉಪಗ್ರಹ ಚಿತ್ರಗಳಿಲ್ಲ.",
        "lake_bed": "{n} ಬೇಸಿಗೆ ಋತುಗಳಲ್ಲಿ ಈ ಸ್ಥಳದಲ್ಲಿ ಕೆರೆಯ ನೀರು ಇತ್ತು: {seasons}.",
        "flooded": "{date} ರಂದು ಈ ಸ್ಥಳದಲ್ಲಿ ಪ್ರವಾಹ ಕಂಡುಬಂದಿದೆ ({event}).",
        "in_buffer": "ಇದು ಕೆರೆಯ ನೀರಿನ ಅಂಚಿನಿಂದ {distance_m} ಮೀ ದೂರದಲ್ಲಿದೆ, {width_m} ಮೀ ಬಫರ್ ವಲಯದ ಒಳಗೆ.",
        "in_buffer_other": "ಇದು ಕೆರೆಯ ನೀರಿನ ಅಂಚಿನಿಂದ {distance_m} ಮೀ ದೂರದಲ್ಲಿದೆ, ಪ್ರಸ್ತಾವಿತ {width_m} ಮೀ ಬಫರ್ ಒಳಗೆ.",
        "wet_after_monsoon": "ಮಳೆಗಾಲದ ನಂತರ ಇಲ್ಲಿ ನೀರು ನಿಂತಿತ್ತು: {seasons}.",
        "near_lake": "ಕೆರೆಯ ಗರಿಷ್ಠ ನೀರಿನ ವ್ಯಾಪ್ತಿ {distance_m} ಮೀ ದೂರದಲ್ಲಿದೆ.",
        "flood_nearby": "{date} ರಂದು 250 ಮೀ ಸುತ್ತಳತೆಯ {pct}% ಪ್ರದೇಶದಲ್ಲಿ ಪ್ರವಾಹ ಇತ್ತು ({event}).",
        "none": "2019 ರಿಂದ ಉಪಗ್ರಹ ದಾಖಲೆಯಲ್ಲಿ ಇಲ್ಲಿ ತೆರೆದ ನೀರು ಕಾಣಿಸಿಲ್ಲ.",
        "checks": [
            "ಸರ್ವೆ ನಂಬರ್ ಪಡೆದು, ಯೋಜನಾ ಪ್ರಾಧಿಕಾರದ ಕೆರೆ ಮತ್ತು ಬಫರ್ ನಕ್ಷೆಗಳೊಂದಿಗೆ ಹೋಲಿಸಿ.",
            "ಜೋರು ಮಳೆಯಲ್ಲಿ ರಸ್ತೆ ಮುಳುಗುತ್ತದೆಯೇ ಎಂದು ನೆರೆಹೊರೆಯವರನ್ನು ಕೇಳಿ.",
            "ಸ್ವಾಧೀನ ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು ಅನುಮೋದಿತ ನಕ್ಷೆಯನ್ನು ವಕೀಲರಿಂದ ಪರಿಶೀಲಿಸಿ.",
        ],
    },
    "te": {
        "high": "అధిక ప్రమాదం: ఈ స్థలంలో లేదా పక్కనే ఉపగ్రహాలు నీటిని చూశాయి.",
        "watch": "జాగ్రత్త: ఈ స్థలం నీటికి దగ్గరగా ఉంది లేదా వర్షాకాలం తర్వాత తడిగా ఉంది.",
        "low": "తక్కువ ప్రమాదం: 2019 నుండి ఉపగ్రహ రికార్డులో ఇక్కడ నీరు కనిపించలేదు.",
        "unknown": "నిర్ణయించడానికి ఇక్కడ తగినన్ని స్పష్టమైన ఉపగ్రహ చిత్రాలు లేవు.",
        "lake_bed": "{n} వేసవి కాలాల్లో ఈ స్థలంలో చెరువు నీరు ఉంది: {seasons}.",
        "flooded": "{date}న ఈ స్థలంలో వరద కనిపించింది ({event}).",
        "in_buffer": "ఇది చెరువు నీటి అంచు నుండి {distance_m} మీ దూరంలో, {width_m} మీ బఫర్ జోన్ లోపల ఉంది.",
        "in_buffer_other": "ఇది చెరువు నీటి అంచు నుండి {distance_m} మీ దూరంలో, ప్రతిపాదిత {width_m} మీ బఫర్ లోపల ఉంది.",
        "wet_after_monsoon": "వర్షాకాలం తర్వాత ఇక్కడ నీరు నిలిచింది: {seasons}.",
        "near_lake": "చెరువు గరిష్ట నీటి విస్తీర్ణం {distance_m} మీ దూరంలో ఉంది.",
        "flood_nearby": "{date}న 250 మీ పరిధిలో {pct}% ప్రాంతం వరదలో ఉంది ({event}).",
        "none": "2019 నుండి ఉపగ్రహ రికార్డులో ఇక్కడ నీరు కనిపించలేదు.",
        "checks": [
            "సర్వే నంబర్ తీసుకుని, ప్రణాళికా సంస్థ చెరువు, బఫర్ మ్యాప్‌లతో సరిచూడండి.",
            "భారీ వర్షంలో వీధి మునుగుతుందేమో పొరుగువారిని అడగండి.",
            "ఆక్యుపెన్సీ సర్టిఫికెట్, ఆమోదిత ప్లాన్‌ను న్యాయవాదితో తనిఖీ చేయించండి.",
        ],
    },
    "hi": {
        "high": "अधिक जोखिम: उपग्रहों ने इस जगह पर या ठीक बगल में पानी देखा है।",
        "watch": "सावधान: यह जगह पानी के पास है या मानसून के बाद गीली रही।",
        "low": "कम जोखिम: 2019 से उपग्रह रिकॉर्ड में यहाँ खुला पानी नहीं दिखा।",
        "unknown": "फ़ैसला करने के लिए यहाँ पर्याप्त साफ़ उपग्रह चित्र नहीं हैं।",
        "lake_bed": "{n} सूखे मौसमों में इस जगह पर झील का पानी था: {seasons}।",
        "flooded": "{date} को इस जगह पर बाढ़ देखी गई ({event})।",
        "in_buffer": "यह झील के पानी के किनारे से {distance_m} मीटर दूर है, {width_m} मीटर बफ़र ज़ोन के अंदर।",
        "in_buffer_other": "यह झील के पानी के किनारे से {distance_m} मीटर दूर है, प्रस्तावित {width_m} मीटर बफ़र के अंदर।",
        "wet_after_monsoon": "मानसून के बाद यहाँ पानी जमा रहा: {seasons}।",
        "near_lake": "झील का सबसे बड़ा जल-क्षेत्र {distance_m} मीटर दूर है।",
        "flood_nearby": "{date} को 250 मीटर के दायरे का {pct}% हिस्सा बाढ़ में था ({event})।",
        "none": "2019 से उपग्रह रिकॉर्ड में यहाँ खुला पानी नहीं दिखा।",
        "checks": [
            "सर्वे नंबर लेकर योजना प्राधिकरण के झील और बफ़र नक्शों से मिलाएँ।",
            "पड़ोसियों से पूछें कि भारी बारिश में गली में पानी भरता है या नहीं।",
            "ऑक्यूपेंसी सर्टिफ़िकेट और स्वीकृत नक्शा किसी वकील से जँचवाएँ।",
        ],
    },
}


def explain_with_template(lvl: str, found: list[dict]) -> dict:
    out = {}
    for lang in LANGUAGES:
        t = _T[lang]
        lines = []
        for r in found:
            vals = {
                **r,
                "n": len(r.get("seasons", [])),
                "seasons": ", ".join(r.get("seasons", [])),
                "pct": round(100 * r.get("share", 0)),
            }
            lines.append(t[r["code"]].format(**vals))
        out[lang] = {
            "headline": t[lvl],
            "summary": " ".join(lines) if lines else t["none"],
            "checks": t["checks"],
        }
    return out


def verdict(facts: dict) -> dict:
    found = reasons(facts)
    lvl = level(facts, found)
    try:
        text, source = explain_with_claude(facts, lvl, found), "bedrock"
    except Exception as e:  # no Bedrock access, refusal, timeout: still answer
        print(f"Bedrock explanation unavailable, using templates: {e!r}"[:500])
        text, source = explain_with_template(lvl, found), "template"
    return {"level": lvl, "reasons": found, "text": text, "text_source": source,
            "model": MODEL if source == "bedrock" else None}
