# Path Finding
This implementation plan is to design a pathfinding algorithm for a 3d map with multiple floors. It should be 


# Modules
1. ngraph.graph
2. ngraph.path



# Scenarios

## Scenario 1
Start Point: Marker Node
End Point: Object

## Scenario 2
Start Point: Object
End Point: Object

# Data

```js
objects = {
    object_id : [
        {exit_id: exit_node_id, nodes: [node_id, node_id]}
    ]
}

markers = {
    marker_id : node_id
}
```

# Algorithm
Use A star algorithm with a heuristic of Euclidean distance with an added wait of 20 per each level
