## curl 또는 postman 이용해 데이터 저장
# 데이터 저장
curl -X POST http://localhost:3000/set/user1 \
  -H "Content-Type: application/json" \
  -d '{"value": {"name": "홍길동", "age": 30}}'

## 브라우저 이용해 확인
# 저장된 값 조회
curl http://localhost:3000/get/user1

# 모든 키 목록 확인
curl http://localhost:3000/keys

# Redis 통계 확인
curl http://localhost:3000/stats

# Redis ping 테스트
curl http://localhost:3000/ping
