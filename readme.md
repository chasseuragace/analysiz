### Validity / Authenticity of Geohash Approach

#### **Context**:
Given a set of coordinates \(C\) and a set of entities \(E\), where each entity \(e \in E\) has coordinates \(C_e \subseteq C\), the problem is to identify entities neighboring a given set of coordinates \(C'\). Neighbors are defined as coordinates within a specified distance \(n\) units.

#### **Definitions**:
- **Neighbors**: Coordinates within a distance \(n\) units from a given point.
  
#### **Methodologies**:

The main challenge is determining which entities are neighbors of a given set of coordinates in an efficient and scalable way. Several approaches exist to solve this problem, including:

### **Approaches**:

1. **Geohash-Based Approach**:
   - **How it works**: Geohashing converts latitude and longitude coordinates into a hashed string. Neighboring locations will have similar or identical geohash prefixes, making string comparison possible.
   - **Efficiency**: Since the method is based on hashing, it is efficient for spatial indexing. Geohashes allow quick searches through prefix matching, reducing the computational overhead compared to other methods that require distance calculation.
   
   **Pros**:
   - High speed due to simple string comparison.
   - Suitable for large-scale data and databases like Postgres.
   
   **Cons**:
   - Accuracy can suffer, especially near geohash boundaries.
   - Fixed precision may make it challenging to adjust for different distances.

2. **Euclidean Distance (Pythagoras' Theorem)**:
   - **How it works**: Calculate the distance between two points using the Euclidean distance formula:
     \[
     d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}
     \]
   - **Efficiency**: This approach guarantees accuracy, but it is computationally expensive, especially when applied over large datasets.
   
   **Pros**:
   - Provides exact results.
   - Flexible to any distance range.
   
   **Cons**:
   - Computationally intensive.
   - Not scalable for large datasets.

3. **Haversine Formula**:
   - **How it works**: Used for calculating distances between points on a sphere (Earth). The formula is:
     \[
     a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1) \cos(\phi_2) \sin^2\left(\frac{\Delta\lambda}{2}\right)
     \]
     \[
     c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)
     \]
     \[
     d = R \cdot c
     \]
   - **Efficiency**: More accurate for geographic coordinates but computationally more expensive than simple 2D Euclidean distance.
   
   **Pros**:
   - High accuracy on a global scale.
   
   **Cons**:
   - More complex to implement.
   - Slower due to trigonometric calculations.

4. **Clustering Algorithms (DBSCAN, K-Means)**:
   - **How it works**: Algorithms like DBSCAN (Density-Based Spatial Clustering of Applications with Noise) group nearby points into clusters, identifying dense regions.
   - **Efficiency**: DBSCAN, in particular, is effective at identifying neighboring entities based on a distance threshold but can be computationally expensive due to its iterative nature.
   
   **Pros**:
   - Useful for finding natural clusters of entities.
   - Handles noise and outliers effectively.
   
   **Cons**:
   - Higher computational complexity.
   - Not as straightforward as Geohashing for simple neighbor-finding tasks.

5. **Machine Learning (K-Nearest Neighbors)**:
   - **How it works**: The KNN algorithm identifies the nearest neighbors of a given coordinate by calculating distances between points.
   - **Efficiency**: It requires calculating the distance to every other point in the dataset, making it slow for large datasets.
   
   **Pros**:
   - Works well for small datasets.
   
   **Cons**:
   - Scalability issues due to brute-force distance calculations.

#### **Findings**:

The geohash-based approach relies on hashing and string comparisons rather than calculating exact distances, leading to performance benefits in certain contexts, particularly for large-scale spatial data. However, its accuracy declines near geohash boundaries or when precision needs to be adjusted for varying distances.

### **Comparison**:

Below is a comparison of different approaches in terms of performance and scalability across different volumes of data (1,000 to 5,000 records) and varying distances.

| **Volume (Records)** | **Geohash (String Comparison)** | **Euclidean (Pythagorean)** | **Haversine Formula** | **DBSCAN (Clustering)** | **KNN (ML-based)** |
|----------------------|---------------------------------|-----------------------------|------------------------|-------------------------|---------------------|
| 1,000                | Very Fast                      | Moderate                    | Slow                   | Moderate                | Slow                |
| 2,000                | Very Fast                      | Moderate                    | Slow                   | Moderate                | Slow                |
| 3,000                | Fast                           | Slower                      | Slow                   | Slow                    | Slower              |
| 5,000                | Fast                           | Very Slow                   | Very Slow              | Very Slow               | Very Slow           |

### **Conclusion**:

- **Geohashing** is efficient for large datasets due to its simple string comparison, but it lacks the accuracy of mathematical distance approaches like Euclidean or Haversine, especially at the boundaries of geohash cells.
- **Euclidean and Haversine distance calculations** provide more precise results but are computationally expensive, making them less ideal for large-scale datasets without optimization.
- **Clustering approaches** like DBSCAN can identify neighboring points but at a higher computational cost, making them less performant compared to geohashing for large datasets.
- **Machine learning approaches** such as KNN are effective for small datasets but scale poorly when the dataset grows.

Ultimately, for tasks requiring quick searches over large geographic datasets, **Geohash-based solutions outperform** other methods in terms of speed, though they may require supplementary logic to handle edge cases for greater accuracy. For smaller datasets or cases where accuracy is paramount, the **Haversine or Euclidean methods** may be better suited, despite their computational overhead.


Create the Docker setup:
```
docker-compose up --build

```
Insert test records:
```
curl -X POST http://localhost:3000/insert -H "Content-Type: application/json" -d '{"n": 1000}'


```
Run performance tests:
```
curl http://localhost:3000/test


```
Delete records:
```
curl -X DELETE http://localhost:3000/delete


```