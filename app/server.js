// app/server.js
const express = require('express');
const redis = require('redis');

const app = express();
const port = 3000;

// Body parser 설정 (중요!)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    headers: req.headers['content-type']
  });
  next();
});

// Redis 클라이언트 생성 (v4 문법)
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
});

// Redis 연결 이벤트
redisClient.on('connect', () => {
  console.log('🔄 Redis 연결 시도 중...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis 연결 성공!');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis 연결 에러:', err);
});

redisClient.on('end', () => {
  console.log('🔌 Redis 연결 종료');
});

// Redis 연결 시작 (중요!)
(async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis 클라이언트 연결 완료');
  } catch (error) {
    console.error('❌ Redis 연결 실패:', error);
  }
})();

app.use(express.json());

// 메인 페이지
app.get('/', (req, res) => {
  res.json({
    message: 'Redis 연동 테스트 서버',
    endpoints: {
      'GET /': '이 페이지',
      'GET /ping': 'Redis ping 테스트',
      'POST /set/:key': 'Redis에 값 저장',
      'GET /get/:key': 'Redis에서 값 조회',
      'GET /stats': 'Redis 통계 정보'
    }
  });
});

// Redis ping 테스트
app.get('/ping', async (req, res) => {
  try {
    const result = await redisClient.ping();
    res.json({ 
      status: 'success', 
      redis_ping: result,
      message: 'Redis 연결 정상!'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Redis에 값 저장 (개선된 버전)
app.post('/set/:key', async (req, res) => {
  try {
    const { key } = req.params;
    console.log('요청 받음:', { key, body: req.body });
    
    // 클라이언트 연결 확인
    if (!redisClient.isOpen) {
      throw new Error('Redis client is not connected');
    }
    
    let valueToStore;
    
    // 요청 본문에서 value 추출 (여러 형태 지원)
    if (req.body.value !== undefined) {
      valueToStore = req.body.value;
    } else if (req.body.data !== undefined) {
      valueToStore = req.body.data;
    } else if (Object.keys(req.body).length > 0) {
      // value 키가 없으면 전체 body를 값으로 사용
      valueToStore = req.body;
    } else {
      return res.status(400).json({ 
        status: 'error', 
        message: '저장할 값이 필요합니다. {"value": "your_data"} 형태로 보내주세요.',
        received_body: req.body
      });
    }
    
    // 값을 문자열로 변환하여 저장
    const stringValue = typeof valueToStore === 'string' ? valueToStore : JSON.stringify(valueToStore);
    
    console.log('Redis에 저장:', { key, stringValue });
    await redisClient.set(key, stringValue);
    
    res.json({ 
      status: 'success', 
      message: `키 '${key}'에 값 저장 완료`,
      key,
      original_value: valueToStore,
      stored_as: stringValue
    });
  } catch (error) {
    console.error('Redis set 에러:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      received_body: req.body
    });
  }
});

// Redis에서 값 조회
app.get('/get/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // 클라이언트 연결 확인
    if (!redisClient.isOpen) {
      throw new Error('Redis client is not connected');
    }
    
    const value = await redisClient.get(key);
    
    let parsedValue = value;
    if (value) {
      try {
        // JSON 파싱 시도
        parsedValue = JSON.parse(value);
      } catch (parseError) {
        // JSON이 아닌 경우 원래 문자열 그대로 사용
        parsedValue = value;
      }
    }
    
    res.json({ 
      status: 'success',
      key,
      value: parsedValue,
      raw_value: value,
      found: value !== null
    });
  } catch (error) {
    console.error('Redis get 에러:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Redis 통계 정보
app.get('/stats', async (req, res) => {
  try {
    // 클라이언트 연결 확인
    if (!redisClient.isOpen) {
      throw new Error('Redis client is not connected');
    }
    
    const info = await redisClient.info();
    const dbSize = await redisClient.dbSize(); // 대소문자 수정: dbsize -> dbSize
    
    res.json({
      status: 'success',
      client_connected: redisClient.isOpen,
      database_size: dbSize,
      redis_info: info.split('\r\n').slice(0, 10) // 처음 10줄만
    });
  } catch (error) {
    console.error('Redis stats 에러:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      client_connected: redisClient.isOpen
    });
  }
});

// 디버깅용 엔드포인트 - 모든 키 조회
app.get('/keys', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      throw new Error('Redis client is not connected');
    }
    
    const keys = await redisClient.keys('*');
    res.json({
      status: 'success',
      keys,
      count: keys.length
    });
  } catch (error) {
    console.error('Redis keys 에러:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// 디버깅용 - 요청 내용 확인
app.post('/debug/set/:key', (req, res) => {
  const { key } = req.params;
  const body = req.body;
  
  res.json({
    message: '요청 내용 디버그',
    key,
    body,
    body_type: typeof body,
    value_type: typeof body.value,
    content_type: req.get('Content-Type'),
    raw_body: JSON.stringify(body)
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 서버가 http://0.0.0.0:${port} 에서 실행 중입니다.`);
});

// 서버 종료 시 Redis 연결도 정리
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  try {
    await redisClient.quit();
    console.log('✅ Redis 연결 정리 완료');
  } catch (error) {
    console.error('❌ Redis 연결 정리 실패:', error);
  }
  process.exit(0);
});
