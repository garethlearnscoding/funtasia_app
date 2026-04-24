import json
import csv

with open("Booth Data - Booth Data.csv", "r") as file:
    data = list(csv.DictReader(file))

print(data)


json_data = {}
for i in data:
    del i["sort_helper"]
    booth_id = i.pop("Booth ID")
    level = "l" + i.pop("Level")
    if "," in i["Tags"]:
        i["Tags"] = i["Tags"].split(",")
    if level not in json_data:
        json_data[level] = {}
    json_data[level][booth_id] = i

with open("funtasia_data.json", "w") as file:
    json.dump(json_data, file, indent=2)
