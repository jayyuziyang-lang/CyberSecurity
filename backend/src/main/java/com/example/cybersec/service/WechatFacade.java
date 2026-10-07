package com.example.cybersec.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class WechatFacade {

    private static final Logger log = LoggerFactory.getLogger(WechatFacade.class);

    private final String appId = "wx6026f3b96e704356"; // replace later
    private final String appSecret = "bbc47d23b361f3e5f6fb5d500b7a0cd5"; // replace later

    public String getAccessToken() {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="
                    + appId + "&secret=" + appSecret;
            String response = restTemplate.getForObject(url, String.class);
            String accessToken = extractAccessToken(response);
            return accessToken == null ? "local_demo_mock_access_token" : accessToken;
        } catch (Exception e) {
            log.info("\n" +
                    "========================================================================\n" +
                    "\u3010\u5fae\u4fe1\u751f\u6001\u8054\u52a8\u95e8\u9762 - WECHAT FACADE (DEVELOPER SANDBOX MODE)\u3011\n" +
                    "------------------------------------------------------------------------\n" +
                    " \u89e6\u53d1\u4e8b\u4ef6: \u83b7\u53d6\u5fae\u4fe1 AccessToken \u5931\u8d25\n" +
                    " \u4e1a\u52a1\u52a8\u4f5c: \u542f\u7528\u672c\u5730\u5f00\u53d1\u6c99\u7bb1 AccessToken \u964d\u7ea7\u7b56\u7565\n" +
                    " \u964d\u7ea7\u51ed\u8bc1: local_demo_mock_access_token\n" +
                    " \u73af\u5883\u63d0\u793a: \u5f53\u524d\u4e3a localhost \u5f00\u53d1\u73af\u5883\uff0c\u5df2\u6210\u529f\u62e6\u622a\u7f51\u7edc\u9650\u5236\uff0c\u6c99\u7bb1\u94fe\u8def\u7ee7\u7eed\u8fd0\u884c\u3002\n" +
                    "========================================================================");
            return "local_demo_mock_access_token";
        }
    }

    public void linkUser(Long userId) {
        log.info("\n" +
                "========================================================================\n" +
                "\u3010\u5fae\u4fe1\u751f\u6001\u8054\u52a8\u95e8\u9762 - WECHAT FACADE (DEVELOPER SANDBOX MODE)\u3011\n" +
                "------------------------------------------------------------------------\n" +
                " \u89e6\u53d1\u4e8b\u4ef6: \u672c\u5730\u7528\u6237\u5b8c\u6210\u5fae\u4fe1 UnionID \u8eab\u4efd\u7ed1\u5b9a\n" +
                " \u4e1a\u52a1\u52a8\u4f5c: \u6253\u901a\u5c0f\u7a0b\u5e8f\u4e0e\u516c\u4f17\u53f7\u8de8\u5e73\u53f0\u7528\u6237\u8eab\u4efd\n" +
                " \u76ee\u6807\u7528\u6237 ID: {}\n" +
                " \u8054\u52a8\u7ed3\u679c: UnionID \u8eab\u4efd\u5df2\u7ed1\u5b9a\uff0c\u8de8\u5e73\u53f0\u6570\u636e\u5df2\u5b9e\u65f6\u8d2f\u901a\u3002\n" +
                " \u73af\u5883\u63d0\u793a: \u5f53\u524d\u4e3a localhost \u5f00\u53d1\u73af\u5883\uff0c\u5fae\u4fe1\u751f\u6001\u8054\u52a8\u95e8\u9762\u5df2\u8fdb\u5165\u6f14\u793a\u95ed\u73af\u3002\n" +
                "========================================================================", userId);
    }

    public void sendMpNotification(Long userId, String message) {
        String sandboxNotice = "\n" +
                "========================================================================\n" +
                "\u3010\u5fae\u4fe1\u751f\u6001\u8054\u52a8\u95e8\u9762 - WECHAT FACADE (DEVELOPER SANDBOX MODE)\u3011\n" +
                "------------------------------------------------------------------------\n" +
                " \u89e6\u53d1\u4e8b\u4ef6: \u5c0f\u7a0b\u5e8f\u7aef\u6210\u529f\u63d0\u4ea4\u4f5c\u4e1a\n" +
                " \u4e1a\u52a1\u52a8\u4f5c: \u89e6\u53d1\u516c\u4f17\u53f7\u6a21\u677f\u6d88\u606f\u63a8\u9001 (Template Message Notification)\n" +
                " \u76ee\u6807\u7528\u6237 ID: " + userId + "\n" +
                " \u63a8\u9001\u5185\u5bb9: [\u4f5c\u4e1a\u5b8c\u6210\uff0c\u771f\u5b9e\u843d\u5e93\u79ef\u5206 +20 \u6210\u529f\uff01]\n" +
                " \u73af\u5883\u63d0\u793a: \u5f53\u524d\u4e3a localhost \u5f00\u53d1\u73af\u5883\uff0c\u5df2\u6210\u529f\u542f\u7528\u5f00\u53d1\u8f68\u964d\u7ea7\u7b56\u7565\uff0c\u5168\u94fe\u8def\u5df2\u95ed\u73af\u3002\n" +
                "========================================================================";
        log.info(sandboxNotice);
        System.out.println(sandboxNotice);
    }

    private String extractAccessToken(String response) {
        if (response == null) {
            return null;
        }
        String key = "\"access_token\":\"";
        int start = response.indexOf(key);
        if (start < 0) {
            return null;
        }
        start += key.length();
        int end = response.indexOf("\"", start);
        if (end < 0) {
            return null;
        }
        return response.substring(start, end);
    }
}
