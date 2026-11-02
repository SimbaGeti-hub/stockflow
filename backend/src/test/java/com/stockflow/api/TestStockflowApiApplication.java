package com.stockflow.api;

import org.springframework.boot.SpringApplication;

public class TestStockflowApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(StockflowApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
