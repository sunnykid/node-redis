## 컨테이너 생성
docker compose -f docker-compose-redis-test.yml up -d

## curl 또는 postman 이용해 데이터 저장
1. 데이터 저장
curl -X POST http://localhost:3000/set/user1 \
  -H "Content-Type: application/json" \
  -d '{"value": {"name": "홍길동", "age": 30}}'

### 브라우저 이용해 확인
2. 저장된 값 조회
curl http://localhost:3000/get/user1

3. 모든 키 목록 확인
curl http://localhost:3000/keys

4. Redis 통계 확인
curl http://localhost:3000/stats

5. Redis ping 테스트
curl http://localhost:3000/ping
