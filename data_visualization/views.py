from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
import requests,re, json, logging
from django.core.cache import cache
from django.conf import settings
from pathlib import Path
import uuid
from datetime import datetime, timezone

def fetch_allergy_data():
    # Define a cache key
    cache_key = 'allergy_data'
    # Set a timeout for cache (e.g., 600 seconds or 10 minutes)
    cache_time = 60000

    # Try to get cached data
    data = cache.get(cache_key)
    if data:
        return data

    # Path to your local jsonResponse.json file
    file_path = Path(settings.BASE_DIR) / 'data_visualization' / 'jsonResponse.json'
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)
        # Store data in cache
        cache.set(cache_key, data, cache_time)
        return data
    except FileNotFoundError:
        logging.error(f"File not found: {file_path}")
        return {"entry": []}  


def clean_specific_reason(reason):
    unwanted_strings = [
        "Modified cashew nut allergenic extract injectable", "Non-steroidal anti-inflammary agent", "Allergy", "to", r"\(disorder\)", r"\(substance\)", r"\(product\)",
        "Product", "containing", r"\(edible\)"
    ]
    pattern = "|".join(unwanted_strings)
    cleaned_reason = re.sub(pattern, "", reason, flags=re.IGNORECASE)
    cleaned_reason = re.sub(r"\bEggs\b", "Egg", cleaned_reason, flags=re.IGNORECASE).strip()
    return cleaned_reason.capitalize()



def parse_allergy_data(raw_data, threshold=50):
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

    # Aggregate smaller categories into 'Other'
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


    # Append the 'Other' category if it contains any items
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
    print("fetch_allergy_data_json was called") 
    raw_data = fetch_allergy_data().get("entry", [])
    allergies = parse_allergy_data(raw_data)
    return JsonResponse(allergies, safe=False) 

logger = logging.getLogger(__name__)

@csrf_exempt
@require_POST

def post_allergy_data(request):
    try:
        new_entry_data = json.loads(request.body)
        logger.info(f"Received new entry data: {new_entry_data}")

        unique_id = str(uuid.uuid4())  # Generate a unique ID
        current_time = datetime.now(timezone.utc).isoformat()  # Generate current time in ISO 8601 format
        
        new_entry = {
            "fullUrl": f"https://hapi.fhir.org/baseR4/AllergyIntolerance/{unique_id}",
            "resource": {
                "resourceType": "AllergyIntolerance",
                "id": unique_id,
                "meta": {
                    "versionId": "1",
                    "lastUpdated": current_time,
                    "source": "#newdata",
                    "profile": [
                        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"
                    ]
                },
                "clinicalStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                            "code": "inactive"
                        }
                    ]
                },
                "verificationStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                            "code": "confirmed"
                        }
                    ]
                },
                "category": [
                    new_entry_data.get("category", "unknown")
                ],
                "criticality": new_entry_data.get("criticality", "unknown"),
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
                                ],
                                "text": new_entry_data["specific_reason"]
                            }
                        ],
                        "severity": "Unknow"
                    }
                ]
            },
            "search": {
                "mode": "match"
            }
        }
    except json.JSONDecodeError:
        logger.error("JSON decode error")
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
        logger.error(f"File not found: {file_path}")
        return HttpResponseBadRequest("File not found")

    cache.delete('allergy_data')

    return JsonResponse({"status": "success"}, status=200)