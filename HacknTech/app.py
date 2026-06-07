from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'narad-super-secret-key-123'
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join_chat')
def handle_join(data):
    room = data.get('room')
    if room:
        join_room(room)
        emit('system_message', {'msg': 'A new operative has securely joined the frequency.'}, to=room)

@socketio.on('leave_chat')
def handle_leave(data):
    room = data.get('room')
    if room:
        leave_room(room)
        emit('system_message', {'msg': 'An operative has severed their connection and left the frequency.'}, to=room)

@socketio.on('encrypted_message')
def handle_message(data):
    room = data.get('room')
    emit('receive_encrypted_message', data, to=room, include_self=False)

if __name__ == '__main__':
    print("=============================================")
    print("      PROJECT NARAD: SECURE SERVER ONLINE    ")
    print("=============================================")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
