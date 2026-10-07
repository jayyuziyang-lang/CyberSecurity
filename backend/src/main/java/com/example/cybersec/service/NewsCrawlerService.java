package com.example.cybersec.service;

public interface NewsCrawlerService {

    /**
     * @param source "ctfhub" or "secrss"
     * @param limit max items to save
     * @return inserted record count
     */
    int crawl(String source, int limit);
}
