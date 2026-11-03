package com.stockflow.api.catalog;

import com.stockflow.api.common.ConflictException;
import com.stockflow.api.common.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        UUID businessId = CurrentUser.businessId();
        String name = request.name().trim();

        if (categoryRepository.existsByBusinessIdAndNameIgnoreCase(businessId, name)) {
            throw new ConflictException("A category with this name already exists.");
        }
        return CategoryResponse.from(categoryRepository.save(new Category(businessId, name)));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        return categoryRepository.findByBusinessIdOrderByNameAsc(CurrentUser.businessId())
                .stream()
                .map(CategoryResponse::from)
                .toList();
    }
}
