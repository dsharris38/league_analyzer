try:
    import pymongo
    print("pymongo imported")
    from bson import Binary
    print("bson.Binary imported")
    import zlib
    print("zlib imported")
    
    data = {1: "test"}
    import json
    json_str = json.dumps(data)
    print(f"JSON dump of int key: {json_str}")
    
except Exception as e:
    print(f"Error: {e}")
