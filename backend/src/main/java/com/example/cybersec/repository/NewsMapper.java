package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.entity.News;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NewsMapper extends BaseMapper<News> {
}