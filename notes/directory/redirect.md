# Redirecting Users after Directory Interaction

## Data Fetching
1. After the web app fetches the `funtasia_data.json` file via js delivr cdn, it needs to be used in modelparser.js. Please ensure that the fetching of data occurs before the models are parsed
2. The data will also be required in forming the content of the directory. Thus, also consider that the final set of data will need to be exposed.

## Processing Data
1. When parsing the model, I require that the code attempts to index into the json data via the level, then the booth id which will be the child.name when parsing the model.
2. If the child name is present in the json data, I require that child.name is replaced with the json data ["Booth Name"] field.
3. If the child name is not present in the json data, just proceed as per usual and no special changes to the name has to be made from the json data
4. After the child.name has been replaced, I require that the world 3d position of the child object is found. This will then be set as the json data ["Location"] field for that specific child.

## Redirecting Users
1. In the directory, when the user clicks on one of the directory objects, I require that the user will get redirected to that object's ["Location"] position in 3d space. Using similar lerp animations as the other camera refocus events, I would like a directoryMarker object to be spawned at the object's position
2. The directoryMarker object needs to be facing the user, similar to the focalpoint system.
3. After this, a bottom sheet modal will appear on the bottom of the screen containing the child.name as the title, with the child["Booth Description"] as the content. As if the user has interacted with the object.
4. There should be a small cross at the top left corner of the UI for the user to clear the active directory marker and close the bottom sheet modal, else, the user should be able to move the model and interact with any other part of it without the directory marker being removed.If the user were to close the bottom sheet modal, the directory marker should still stay.

## Files to refer to
1. `json_data/funtasia_data.json` - Contains the data for the directory.
2. `src/js/floor/modelparser.js` - Contains the code for parsing the model.
3. `src/js/feature/directory.js` - Contains the code for the directory.
4. `src/js/marker/directorymarker.js` - Contains the code for the directory marker.