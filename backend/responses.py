from flask import jsonify


def ok(data=None, message="", status=200):
    resp = jsonify({"success": True, "message": message, "data": data if data is not None else {}})
    resp.status_code = status
    return resp


def fail(message, errors=None, status=400):
    resp = jsonify({"success": False, "message": message, "errors": errors or []})
    resp.status_code = status
    return resp
