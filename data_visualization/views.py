from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json, logging, re
from django.core.cache import cache
from django.conf import settings
from pathlib import Path
from datetime import datetime, timezone

# Correct category mappings
correct_category_mappings = {
    "food": ["strawberries", "walnut", "egg", "seafood", "strawberry", "egg protein", "nut", "peanut", "cashew nuts", "shellfish", "fish", "meat", "broccoli", "branston pickle"],
    "medication": ["penicillin g", "amoxicillin", "benadryl", "paracetamol", "codeine", "ibuprofen"],
    "environment": ["feather", "house dust mite", "mould", "house dust", "cat dander", "dander (animal)", "tree pollen", "grass pollen", "pollen", "dust", "latex", "perfume", "fungus"],
    "other": ["hemoglobin okaloosa", "alkaline phosphatase bone isoenzyme", "gastrointestinal system", "enzyme variant 1", "galactosyl-n-acetylglucosaminylgalactosylglucosylceramide alpha-galactosyltransferase", "tuberculin"]
}

def clean_specific_reason(reason):
    unwanted_strings = [
        "modified", "allergenic extract", "injectable", "non-steroidal anti-inflammatory agent", "allergy", "to", r"\(disorder\)", r"\(substance\)", r"\(product\)",
        "product", "containing", r"\(edible\)"
    ]
    pattern = "|".join(unwanted_strings)
    cleaned_reason = re.sub(pattern, "", reason, flags=re.IGNORECASE).strip()
    
    # Normalize pollen-related reasons
    cleaned_reason = cleaned_reason.replace("grass pollen", "pollen")
    cleaned_reason = cleaned_reason.replace("tree pollen", "pollen")
    cleaned_reason = cleaned_reason.replace("peanuts", "peanut")

    return cleaned_reason.lower()

def correct_allergy_data(data):
    for entry in data['entry']:
        resource = entry.get('resource', {})
        specific_reason = resource.get('code', {}).get('coding', [{}])[0].get('display', "")
        cleaned_reason = clean_specific_reason(specific_reason)
        
        mapped = False
        for category, reasons in correct_category_mappings.items():
            if cleaned_reason in reasons:
                resource['category'] = [category.capitalize()]
                mapped = True
                break
        
        if not mapped:
            logging.warning(f"Specific reason '{specific_reason}' not categorized correctly.")
            
    return data

def fetch_allergy_data():
    cache_key = 'allergy_data'
    cache_time = 60000
    data = cache.get(cache_key)
    if data:
        return data

    file_path = Path(settings.BASE_DIR) / 'data_visualization' / 'jsonResponse.json'
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)
            data = correct_allergy_data(data)
        cache.set(cache_key, data, cache_time)
        return data
    except FileNotFoundError:
        logging.error(f"File not found: {file_path}")
        return {"entry": []}

def parse_allergy_data(raw_data, threshold=5):
    category_counts = {}
    for entry in raw_data:
        resource = entry.get("resource", {})
        categories = resource.get("category", [])
        criticality = resource.get("criticality", "")
        code_info = resource.get("code", {}).get("coding", [{}])[0]
        specific_reason = clean_specific_reason(code_info.get("display", ""))

        if categories and criticality and specific_reason:
            for category in categories:
                if category in category_counts:
                    category_counts[category].append({
                        "criticality": criticality,
                        "specific_reason": specific_reason,
                    })
                else:
                    category_counts[category] = [{
                        "criticality": criticality,
                        "specific_reason": specific_reason,
                    }]

    parsed_allergies = []
    other_category = []
    s_number = 1

    for category, details in category_counts.items():
        if len(details) < threshold:
            other_category.extend(details)
        else:
            for detail in details:
                parsed_allergies.append({
                    "s_number": s_number,
                    "category": category,
                    "criticality": detail["criticality"],
                    "specific_reason": detail["specific_reason"],
                })
                s_number += 1

    if other_category:
        for detail in other_category:
            parsed_allergies.append({
                "s_number": s_number,
                "category": "Other",
                "criticality": detail["criticality"],
                "specific_reason": detail["specific_reason"],
            })
            s_number += 1

    return parsed_allergies

def allergy_visualization_view(request):
    raw_data = fetch_allergy_data().get("entry", [])
    allergies = parse_allergy_data(raw_data)
    return render(request, "data_visualization/index.html", {"allergies": allergies})

def fetch_allergy_data_json(request):
    raw_data = fetch_allergy_data().get("entry", [])
    allergies = parse_allergy_data(raw_data)
    return JsonResponse(allergies, safe=False)

@csrf_exempt
@require_POST
def post_allergy_data(request):
    try:
        new_entry_data = json.loads(request.body)
        new_entry = {
            "fullUrl": f"https://hapi.fhir.org/baseR4/AllergyIntolerance/{new_entry_data['id']}",
            "resource": {
                "resourceType": "AllergyIntolerance",
                "id": new_entry_data.get("id", ""),
                "meta": {
                    "versionId": "1",
                    "lastUpdated": datetime.now(timezone.utc).isoformat(),
                    "source": "#newdata"
                },
                "type": "allergy",
                "category": [new_entry_data.get("category", "").capitalize()],
                "criticality": new_entry_data.get("criticality", ""),
                "code": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "unknown",
                            "display": new_entry_data["specific_reason"]
                        }
                    ]
                },
                "patient": {
                    "reference": f"Patient/{new_entry_data.get('patient', 'unknown')}"
                },
                "recorder": {
                    "reference": f"Practitioner/{new_entry_data.get('recorder', 'unknown')}"
                },
                "reaction": [
                    {
                        "manifestation": [
                            {
                                "coding": [
                                    {
                                        "system": "http://snomed.info/sct",
                                        "code": "unknown",
                                        "display": new_entry_data["specific_reason"]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            "search": {
                "mode": "match"
            }
        }
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    file_path = Path(settings.BASE_DIR) / 'data_visualization' / 'jsonResponse.json'
    try:
        with open(file_path, 'r+') as file:
            data = json.load(file)
            if 'entry' in data:
                data['entry'].append(new_entry)
            else:
                data['entry'] = [new_entry]
            file.seek(0)
            json.dump(data, file, indent=4)
            file.truncate()
    except FileNotFoundError:
        logging.error(f"File not found: {file_path}")
        return HttpResponseBadRequest("File not found")

    cache.delete('allergy_data')

    return JsonResponse({"status": "success"}, status=200)
