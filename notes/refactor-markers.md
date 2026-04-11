# Refactor Markers

class Marker:
- indicator: three.js group
- position: three.js vector3
- appstate: AppState

class IconMarker(Marker):
- indicator overriden by icon sprite

class LocationMarker(Marker):
- indicator utilises createMarkerGroup

class QRMarker(LocationMarker):
- indicator renders (glb, ring & text group)

class DirectoryMarker(LocationMarker):
- indicator renders (glb, ring)
                        
