import { Model, Document, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';

// Generic base repository providing standard CRUD operations on Mongoose models
export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  // Find a single document matching the filter query
  async findOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  // Find a document by its primary key ObjectId
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.model.findById(id, null, options).exec();
  }

  // Find all documents matching the query filter
  async find(filter: FilterQuery<T>, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, null, options).exec();
  }

  // Persist a newly created document into the collection
  async create(doc: Partial<T>): Promise<T> {
    return this.model.create(doc);
  }

  // Update a single document by its primary key
  async updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, ...options }).exec();
  }

  // Remove a document by its primary key
  async deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  // Count the total number of documents matching the filter
  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}

