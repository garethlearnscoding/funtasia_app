# Restructure parseModel Function in modelParser.js

* When traversing through the model, immediately return if the object has no ROLE
1. resolve user data from parent group for split meshes
2. if child.userData.ROLE = `GREY` set it's BasicMeshMaterial to transparent
3. if child.name appear in textMarkerMap, add a text marker for it (references lines 187 - 196 in modelParser.js) 
4. if child.userData.Zone is undefined, set it to none
5. define if the child is an interactable object by checking if it is a mesh and has a zone
6. if the child is not interactive, check if it is an icon and do the necessary processing and then return (reference lines 223 - 257 in modelParser.js) 
7. next parse the model but use miscSchema for the colours else, use zoneSchema for the colours
8. then calculate the brighter colour for the top face (reference lines 263 - 269 in modelParser.js)
9. then return for non interactive children 
10. handle data attribution (reference lines 279 - 303 in modelParser.js)