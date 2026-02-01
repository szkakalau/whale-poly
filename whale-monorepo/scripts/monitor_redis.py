
import redis
import sys

def monitor():
    r = redis.Redis(host='localhost', port=6379, db=0)
    try:
        with r.monitor() as m:
          print("Monitoring Redis commands (all)...")
          for item in m.listen():
            cmd = item['command']
            # cmd is a tuple like ('RPUSH', 'key', 'value')
            if isinstance(cmd, (tuple, list)) and len(cmd) >= 2:
              print(f"{cmd[0]} {cmd[1]}")
            else:
              print(cmd)
            sys.stdout.flush()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    monitor()
