import json
import csv

with open("Booth Data - Booth Data.csv", "r") as file:
    data = list(csv.DictReader(file))

print(data)


json_data = {}
for i in data:
    del i["sort_helper"]
    booth_id = i.pop("booth_id")
    level = i.pop("level")
    cleaned_level = level[0].lower()+level[1]
    if "," in i["tags"]:
        i["tags"] = i["tags"].split(",")
    if "," in i["invis_tags"]:
        i["invis_tags"] = i["invis_tags"].split(",")
    if cleaned_level not in json_data:
        json_data[cleaned_level] = {}
    json_data[cleaned_level][booth_id] = i

with open("funtasia_data.json", "w") as file:
    json.dump(json_data, file, indent=2)
